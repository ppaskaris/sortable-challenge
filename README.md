# Sortable Challenge

My attempt at Sortable's [Coding Challenge](https://sortable.com/challenge/).
Products and listings are read from `data/products.txt` and `data/listings.txt`
respectively. Run it from a shell like so:

```sh
$ node index.js > results.txt
```

It is requires Node.js 6.x and is very slow.

## Algorithm

We create two inverted indexes from the listings: one for `manufacturer`
keywords, and another for `title` keywords. We then create a set of all
available (unmatched) listings, since a listing may only match at most one
product.

For each listing, we classify it into`manufacturer` keywords and `title`
keywords. This is done by taking those fields from the listings, lower-casing
and trimming them, tokenizing them by word boundry (alpha-numeric, plus `,.-`),
and filtering out stop words.

For each product, we classify it into `manufacturer` keywords and `title`
keywords (`manufacturer`, `family`, and `model`). We sort the products prior to
matching by their `title` keywords cardinality so that we match more specific
products before less specific ones.

For each product in order, we find listings that match all of the product's
`manufacturer` keywords, limiting the results to those in the set of available
listings. We then find listings that match all of the product's `title`
keywords, limiting the results to those included in the previous look-up. Each
matched listing is then removed from the set of available listings.

## Caveats

We have no general way of excluding listings containing only first-party
accessories such as batteries. These listings match on the `manufacturer`,
`family`, and `model` terms and closely resemble bundles (but not in price).
Without product MSRP information, it seems foolhardy to filter listings by
minimum price: any value would be a undefensible guess. It is also unclear
whether the listings include sale discounts.

We have no general way of including listings that don't specify the family
without introducing many false positives. For example, "Lecia Digilux Zoom"
without "Digilux" matches "Lecia D-LUX 4 with Zoom" _better_ than "Lecia D-LUX
4" without "D-LUX".
