# PixDB

Promise-based indexedDB: a wrapper object which provides a nicer and more useable API for client-side storage in indexedDB.


## Compatibility

**PixDB** is compatible with modern browsers which supports ES modules.


## Installation

Load the module from a CDN:

```js
import { PixDB } from 'https://cdn.jsdelivr.net/npm/pixdb/dist/pixdb.js'
```

If using `npm` and a bundler, install with:

```sh
npm install pixdb
```

then import the module locally *(path resolution will depend on the bundler)*:

```js
import { PixDB } from './node_modules/pixdb/dist/pixdb.js';
```


## Examples

Most methods are asynchronous and Promise-based so you must use `async`/`await` or `.then`.

Initialize a new connection with a database name, version, and an optional upgrade function. The upgrade function receives the connection, the old version number, and the new version number so it can create object stores and indexes:

```js
// initialize
const db = await new PixDB('db', 1, (init, oldVersion, newVersion) => {

  log(`upgrading database from ${ oldVersion } to ${ newVersion }`);

  switch (oldVersion) {

    case 0: {
      const state = init.createObjectStore('state', { keyPath: 'name' });
      state.createIndex('updateIdx', 'update', { unique: false });
    }

  }

});
```

This creates an object store named `state` which with the key on the `name` property and an index named `updateIdx` on the `update` property.

You can check the connection, name, and version:

```js
// db 1 true
console.log( db.name, db.version, db.isConnected );
```

Add a single new record into `state` - *but not permit overwrites*:

```js
await db.add({ store: 'state', item: { name: 'a', value: 1, update: new Date() } });
```

or add an array of records (again, overwriting is not permitted):

```js
await db.add({ store: 'state', item: [
    { name: 'b', value: 'two', update: new Date() },
    { name: 'c', value: [3,3,3], update: new Date() }
  ]
});
```

The `.put()` method is identical to `.add()` except it permits overwrites:

```js
await db.put({ store: 'state', item: { name: 'a', value: 'new' } });
```

Count the number of items in a store:

```js
// 3
await db.count({ store: 'state' });
```

Get a single value by its key:

```js
// { name: 'a', value: 'new' }
await db.get({ store: 'state', key: 'a'});
```

Get an array of all values with a `lowerBound`, `upperBound`, and maximum `count` of records:

```js
// [
//   { name: 'a', value: 'new' },
//   { name: 'b', value: 'two', update: '2023-08-18' },
//   { name: 'c', value: [3,3,3], update: '2023-08-18' }
// ]
await db.getAll({ store: 'state', lowerBound: 'a', upperBound: 'z', count: 5 });
```

Get an array of all store keys:

```js
// ['a', 'b', 'c']
await db.getAllKeys({ store: 'state' });
```

Use a cursor to iterate through each record one at a time and pass the value to a synchronous callback function:

```js
await db.getCursor({
  store: 'state',
  callback: cursor => console.log(cursor.value)
});
```

Note that if the callback function returns a numeric number greater than 1, it will jump forward that number of records.

Delete a record using its key:

```js
await db.delete({ store: 'state', key: 'a' });
```

Clear every record in a store:

```js
await db.clear({ store: 'state' });
```

Close the database connection:

```js
await db.close();
```


## API reference

Most `PixDB` object methods:

* use a single object parameter with specific properties, and
* return a Promise which resolves on success or rejects on failure.

The `PixDB` constructor parameters:

| name | type | description |
|-|-|-|
| `name` | string | database name |
| `version` | number | version number |
| `upgrade` | function | upgrade function |

The `upgrade` function is passed the database connection, oldVersion, and newVersion.

The constructor returns a Promise which resolves/rejects when a database connection is established so `await` must be used:

Example:

```js
const db = await new PixDB('db', 1, (init, oldVersion, newVersion) => {

  log(`upgrading database from ${ oldVersion } to ${ newVersion }`);

  switch (oldVersion) {

    case 0: {
      const state = init.createObjectStore('state', { keyPath: 'name' });
      state.createIndex('updateIdx', 'update', { unique: false });
    }

  }

});
```


### .isConnected

Returns `true` when the database connection is active.


### .name

Returns the database name string (or `null` if the database is dropped).


### .version

Returns the database version number (or `null` if the database is dropped).


### .add( paramObject )

Add one or more new records but does not permit overwrites.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `item` | object \| array | single record or an array of records to add |

Returns a Promise which resolves/rejects when all records have been written.

```js
// add one record
await db.add({ store: 'state', item: { name: 'a', value: 1 } });

// add more than one record in one transaction
await db.add({ store: 'state', item: [
  { name: 'b', value: 2 },
  { name: 'c', value: 3 }
  ]
});
```


### .put( paramObject )

Identical to [.add()](#add-paramobject) except overwrites are permitted.


### .delete( paramObject )

Delete a record in an object store by key name.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `key` | * | key value (required) |

Returns a Promise which resolves/rejects when the record is deleted. It also resolves if the record does not exist.

```js
await db.delete({ store: 'state', key: 'a' });
```


### .clear( paramObject )

Delete all records in an object store.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |

Returns a Promise which resolves/rejects when all store records are deleted.

```js
await db.clear({ store: 'state' });
```


### .count( paramObject )

Count records in an object store or index.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `index` | string | object store index |
| `lowerBound` | * | lower key value |
| `upperBound` | * | upper key value |

Returns a Promise which resolves/rejects when number of records is known.

```js
// number of records in 'state'
await db.count({ store: 'state' });

// number of records in 'state' starting from 'x'
await db.count({ store: 'state', lowerBound: 'x' });
```


### .get( paramObject )

Fetches a single record referenced by key or index key.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `index` | string | object store index |
| `key` | * | key value (required) |

Returns a Promise which resolves/rejects when record is found or not found.

```js
const a = await db.get({ store: 'state', key: 'a'});
```


### .getAll( paramObject )

Fetches an array of records referenced between optional lower and upper boundaries on a store or index.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `index` | string | object store index |
| `lowerBound` | * | lower key value |
| `upperBound` | * | upper key value |
| `count` | number | maximum number of records |

Returns a Promise which resolves/rejects when an array of records is found.

```js
const all = await db.getAll({ store: 'state', lowerBound: 'a', upperBound: 'z', count: 10 });
```


### .getAllKeys( paramObject )

Fetches an array of record keys referenced between optional lower and upper boundaries on a store or index.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `index` | string | object store index |
| `lowerBound` | * | lower key value |
| `upperBound` | * | upper key value |
| `count` | number | maximum number of records |

Returns a Promise which resolves/rejects when an array of keys is found.

```js
const allKeys = await db.getAllKeys({ store: 'state' });
```


### .getCursor( paramObject )

Fetches all records in a store or index range and pass each to a processing callback function.

`paramObject` properties:

| property | type | description |
|-|-|-|
| `store` | string | object store (required) |
| `index` | string | object store index |
| `lowerBound` | * | lower key value |
| `upperBound` | * | upper key value |
| `direction` | string | direction to travel: `next` (default), `nextunique`, `prev`, or `prevunique` |
| `callback` | function | the cursor is passed to this synchronous function so [cursor methods](https://developer.mozilla.org/docs/Web/API/IDBCursor) can be used. The function can optionally return a positive integer to jump forward N records |

Returns a Promise which resolves/rejects once all records have been processed.

```js
await db.getCursor({
  store: 'state',
  callback: cursor => console.log(cursor.value)
});
```


### .close()

Close the database connection. Nothing is returned.

```js
db.close();
```


### .connect()

Reconnect to database after `.close()` has closed a connection. Returns a Promise which resolves/rejects when the database connection is established.

```js
await db.connect();
```


### .drop()

Delete the whole database, its stores, indexes, and data. Returns a Promise which resolves/rejects when database has been deleted.

```js
await db.drop();
```


## Usage policy

You are free to use this as you like but please do not republish it as your own work.

Please consider [sponsorship](https://github.com/sponsors/craigbuckler) if you use **PixDB** commercially, require support, or need new features.
