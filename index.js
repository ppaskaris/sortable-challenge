'use strict';

const Promise = require('bluebird');
const Fs = Promise.promisifyAll(require('fs'));

const reToken = /[a-z0-9.,-]+/g;

// Empty collections to reduce unncessary allocations.
const emptyArray = [];
const emptySet = new Set();

const parseJsonLine = function (text) {

  const lines = text.split('\n');
  return lines.map((line) => {

    try {
      return JSON.parse(line);
    }
    catch (err) {
      return null;
    }
  }).filter((object) => {

    return object !== null;
  });
};

const parseWordList = function (text) {

  const lines = text.split('\n');
  return lines.filter((line) => {

    return line.length > 0 && !line.startsWith('#');
  });
};

class InvertedIndex {

  constructor() {

    this._index = new Map();
  }

  add(item, words) {

    words.forEach((word) => {

      let values = this._index.get(word);
      if (values === undefined) {
        this._index.set(word, values = new Set());
      }
      values.add(item);
    });
  }

  _bySize(set1, set2) {

    return set1.size - set2.size;
  }

  _intersection(sets) {

    // Sort by size ascending to minimize the amount of intersection tests.
    sets.sort(this._bySize);

    const intersection = [];
    const firstSet = sets[0];
    for (const item of firstSet) {
      let shouldAdd = true;
      for (let i = 1; i < sets.length; ++i) {
        if (!sets[i].has(item)) {
          shouldAdd = false;
          break;
        }
      }
      if (shouldAdd) {
        intersection.push(item);
      }
    }
    return intersection;
  }

  findAll(words, domain) {

    const itemss = words
      .map((word) => {

        const items = this._index.get(word);
        return items !== undefined ? items : emptySet;
      });

    itemss.unshift(domain);

    const intersection = this._intersection(itemss);
    return intersection;
  }
}

class KeywordClassifier {

  constructor(stopWords) {

    this._stopWords = new Set(stopWords);
  }

  _isNonEmptyString(text) {

    return typeof text === 'string' && text.length > 0;
  }

  _isNonStopWord(word) {

    return !this._stopWords.has(word);
  }

  _toKeywords(text) {

    const words = text.trim().toLowerCase().match(reToken);
    if (words === null) {
      return emptyArray;
    }

    return words.filter(this._isNonStopWord, this);
  }

  _addToSet(set, array) {

    for (let i = 0; i < array.length; ++i) {
      set.add(array[i]);
    }
    return set;
  }

  classify(...texts) {

    const uniqueWords = texts
      .filter(this._isNonEmptyString)
      .map(this._toKeywords, this)
      .reduce(this._addToSet, new Set());

    return Array.from(uniqueWords);
  }
}

class OppositeSet {

  constructor(iterable) {

    this._set = new Set(iterable);
  }

  get size() {

    return Infinity;
  }

  delete(value) {

    this._set.add(value);
    return this;
  }

  has(value) {

    return !this._set.has(value);
  }

  [Symbol.iterator]() {

    throw new Error('OppositeSet[@@iterator]() is non-sensical.');
  }
}

const matchListingsWithProducts = function (listings, products, stopWords) {

  const classifier = new KeywordClassifier(stopWords);

  const mfgIndex = new InvertedIndex();
  const titleIndex = new InvertedIndex();

  listings.forEach((listing) => {

    const mfgKeywords = classifier
      .classify(listing.manufacturer);
    const titleKeywords = classifier
      .classify(listing.title, listing.manufacturer);

    mfgIndex.add(listing, mfgKeywords);
    titleIndex.add(listing, titleKeywords);
  });

  // A listing can only match one product, so keep track of available ones.
  const availableListings = new OppositeSet();

  const results = products
    .map((product) => {

      return {
        product_name: product.product_name,
        mfgKeywords: classifier
          .classify(product.manufacturer),
        titleKeywords: classifier
          .classify(product.manufacturer, product.family, product.model)
      };
    })
    .sort((product1, product2) => {

      // Match products having more specific keywords first.
      return product2.titleKeywords.length - product1.titleKeywords.length;
    })
    .map((product) => {

      const mfgMatches = mfgIndex
        .findAll(product.mfgKeywords, availableListings);
      const titleMatches = titleIndex
        .findAll(product.titleKeywords, new Set(mfgMatches));

      titleMatches.forEach((listing) => {

        availableListings.delete(listing);
      });

      const result = {
        product_name: product.product_name,
        listings: titleMatches
      };

      return result;
    });

  return results;
};

const listingsPromise = Fs.readFileAsync('./data/listings.txt', 'utf8')
  .then(parseJsonLine);
const productsPromise = Fs.readFileAsync('./data/products.txt', 'utf8')
  .then(parseJsonLine);
const stopWordsPromise = Fs.readFileAsync('./data/products.txt', 'utf8')
  .then(parseWordList);

return Promise.all([listingsPromise, productsPromise, stopWordsPromise])
  .spread(matchListingsWithProducts)
  .then((results) => {

    for (const { product_name, listings } of results) {
      console.log(product_name);
      for (const { title } of listings) {
        console.log(' => ' + title);
      }
    }
    return;
    const lines = results.map((result) => {

      return JSON.stringify(result);
    });
    const text = lines.join('\n');
    process.stdout.write(text);
  })
  .catch((err) => {

    console.error(err);
    process.exit(1);
  });
