/**
 * Promise-based IndexedDB object class
 * @class
 */
export class PixDB {

  #db = null;
  #dbName = null;
  #dbVersion = null;

  /**
   * initialize database
   * @param {string} dbName - database name
   * @param {number} dbVersion - database version
   * @param {function} dbUpgradeFn - database upgrade function (passed init, oldVersion, newVersion)
   * @return {Promise} - resolves/rejects when database connection is established
   * @example
   * const db = await new ClientDB('test', 1, (init, oldVersion, newVersion) => {
   *   console.log(`upgrading database from ${ oldVersion } to ${ newVersion }`);
   *   switch (oldVersion) {
   *     case 0: { init.createObjectStore('state', { keyPath: 'name' }); }
   *   }
   * });
   */
  constructor( dbName, dbVersion, dbUpgradeFn ) {

    this.#dbName = dbName || 'db';
    this.#dbVersion = dbVersion || 1;

    return this.#dbConnect( dbUpgradeFn );

  }


  /**
   * reconnect to database after close() has been run
   * @returns {Promise} - resolves/rejects when database connection is established
   */
  connect() {
    return this.#dbConnect().then(() => true).catch(() => false);
  }


  /**
   * close database connection
   */
  close() {
    this.#db.close();
    this.#db = null;
  }


  /**
   * PRIVATE: initialize database Promise
   * @private
   * @param {function} dbUpgradeFn - database upgrade function (passed init, oldVersion, newVersion)
   * @return {Promise} - resolves/rejects when database connection is established
   */
  #dbConnect( dbUpgradeFn ) {

    return new Promise((resolve, reject) => {

      // no IndexedDB support
      if (!('indexedDB' in window)) {
        reject(new Error('No indexedDB support'));
        return;
      }

      // open database
      const dbOpen = indexedDB.open(this.#dbName, this.#dbVersion);

      // success
      dbOpen.onsuccess = () => {
        this.#db = dbOpen.result;
        resolve( this );
      };

      // failure
      dbOpen.onerror = e => {
        console.log(e);
        reject(new Error(`IndexedDB error ${ e.target.errorCode }: ${ e.target.message }`, { cause: e }));
      };

      // database upgrade event
      if (dbUpgradeFn) {

        dbOpen.onupgradeneeded = e => {
          dbUpgradeFn( dbOpen.result, e.oldVersion, e.newVersion );
        };

      }

    });

  }


  /**
   * is database connection active?
   * @return {boolean} - database connection state
   */
  get isConnected() {
    return !!this.#db;
  }


  /**
   * get active database name
   * @return {string} - database name
   */
  get name() {
    return this.#dbName;
  }


  /**
   * get active database version
   * @return {number} - database version
   */
  get version() {
    return this.#dbVersion;
  }


  /**
   * PRIVATE: generic database update
   * @private
   * @param {string} storeName - store to update
   * @param {object|array} record - single object or array of objects to store
   * @param {boolean} overwrite - set true to permit record overwrites
   * @return {Promise} - resolves/rejects when all records have been written
   */
  #update(storeName, record, overwrite) {

    return new Promise((resolve, reject) => {

      // readwrite transaction
      const { transaction, store } = this.#query(storeName, null, true);

      transaction.oncomplete = () => resolve();

      transaction.onerror = e => {
        reject( new Error(e.target.error.message, { cause: e }) );
      };

      // ensure values in an array
      record = Array.isArray(record) ? record : [ record ];

      // write all values
      record.forEach(v => {
        if (overwrite) store.put(v);
        else store.add(v);
      });

      // commit changes
      transaction.commit();

    });

  }


  /**
   * add new records (overwrites not permitted)
   * @param {cbject} param
   * @param {string} param.store - object store (required)
   * @param {object|array} param.item - single record or an array of records to add
   * @return {Promise} - resolves/rejects when all records have been written
   * @example
   * // add single record
   * await db.add({ store: 'state', item: { name: 'a', value: 1 } });
   * @example
   * // add two records
   * await db.add({ store: 'state', item: [ { name: 'b', value: 2 }, { name: 'c', value: 3 } ] });
   */
  add({ store, item = [] } = {}) {
    return this.#update(store, item, false);
  }


  /**
   * add/update records (overwrites permitted)
   * @param {cbject} param
   * @param {string} param.store - object store (required)
   * @param {object|array} param.item - single record or an array of records to add
   * @return {Promise} - resolves/rejects when all records have been written
   * @example
   * // add/update single record
   * await db.add({ store: 'state', item: { name: 'a', value: 99 } });
   * @example
   * // add/update two records
   * await db.add({ store: 'state', item: [ { name: 'b', value: 98 }, { name: 'c', value: 97 } ] });
   */
  put({ store, item = [] } = {}) {
    return this.#update(store, item, true);
  }


  /**
   * PRIVATE: generic database execute
   * @private
   * @param {string} storeName - store to use
   * @param {string} indexName - index to use
   * @param {string} method - store/index method to execute
   * @param {array} args - array of method arguments
   * @return {Promise} Resolves/rejects when operation completes
   */
  #exec(storeName, indexName, method, args) {

    return new Promise((resolve, reject) => {

      args = Array.isArray(args) ? args : [ args ];

      const
        write = method === 'delete' || method === 'clear',
        request = this.#query(storeName, indexName, write).store[ method ]( ...args );

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? false);

    });

  }


  /**
   * count items in an object store/index
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} param.lowerBound - lower key value
   * @param {*} param.upperBound - upper key value
   * @returns {Promise} - resolves/rejects when number of records is known
   * @example
   * console.log(`records in 'state' store: ${ await db.count({ store: 'state' }) }`);
   * @example
   * console.log(`records in 'state' store starting at 'x': ${ await db.count({ store: 'state', lowerBound: 'x' }) }`);
   */
  count({ store, index, lowerBound, upperBound } = {}) {

    return this.#exec(
      store,
      index,
      'count',
      this.#bound(lowerBound, upperBound)
    );

  }


  /**
   * return a single item by key
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} key - key value to find (required)
   * @returns {Promise} - resolves/rejects when record is found or not found
   * @example
   * const a = await db.get({ store: 'state', key: 'a'});
   */
  get({ store, index, key } = {}) {

    return this.#exec(
      store,
      index,
      'get',
      key
    );

  }


  /**
   * returns an array of records in a range
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} param.lowerBound - lower key value
   * @param {*} param.upperBound - upper key value
   * @param {number} param.count - maximum number of records to return
   * @returns {Promise} - resolves/rejects when an array of records is found
   * @example
   * const all = await db.getAll({ store: 'state', lowerBound: 'a', upperBound: 'z' });
   */
  getAll({ store, index, lowerBound, upperBound, count } = {}) {

    return this.#exec(
      store,
      index,
      'getAll',
      [ this.#bound(lowerBound, upperBound), count ]
    );

  }


  /**
   * returns an array of key values in a range
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} param.lowerBound - lower key value
   * @param {*} param.upperBound - upper key value
   * @param {number} param.count - maximum number of records to return
   * @returns {Promise} - resolves/rejects when an array of keys is found
   * @example
   * const allKeys = await db.getAllKeys({ store: 'state' });
   */
  getAllKeys({ store, index, lowerBound, upperBound, count } = {}) {

    return this.#exec(
      store,
      index,
      'getAllKeys',
      [ this.#bound(lowerBound, upperBound), count ]
    );

  }


  /**
   * delete a record
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {*} key - key value to find (required)
   * @returns {Promise} - resolves/rejects when record is deleted
   * @example
   * await db.delete({ store: 'state', key: 'a' });
   */
  delete({ store, key } = {}) {

    return this.#exec(
      store,
      null,
      'delete',
      [ key ]
    );

  }


  /**
   * delete all records in a range
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} param.lowerBound - lower key value
   * @param {*} param.upperBound - upper key value
   * @returns {Promise} - resolves/rejects when all records are deleted
   * @example
   * await db.deleteAll({ store: 'state', lowerBound: 'x', upperBound: 'z' });
   */
  deleteAll({ store, index, lowerBound, upperBound } = {}) {

    return this.#exec(
      store,
      index,
      'delete',
      [ this.#bound(lowerBound, upperBound) ]
    );

  }


  /**
   * deletes all records in a store
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @returns {Promise} - resolves/rejects when all records are deleted
   * @example
   * await db.clear({ store: 'state' });
   */
  clear({ store } = {}) {

    return this.#exec(
      store,
      null,
      'clear'
    );

  }


  /**
   * fetch all records in a range and pass each to a processing function
   * @param {object} param
   * @param {string} param.store - object store (required)
   * @param {string} param.index - object store index
   * @param {*} param.lowerBound - lower key value
   * @param {*} param.upperBound - upper key value
   * @param {string} param.direction - direction to travel (next, nextunique, prev, prevunique)
   * @param {function} param.callback - cursor is passed to this synchronous function. It can return a positive integer to jump forward N records
   * @returns {Promise} - resolves/rejects once all records have been processed
   * @example
   * await db.getCursor({
   *   store: 'state',
   *   callback: cursor => console.log(cursor.value)
   * });
   */
  getCursor({ store, index, lowerBound, upperBound, direction = 'next', callback } = {}) {

    return new Promise((resolve, reject) => {

      const
        request = this.#query(store, index).store.openCursor(
          this.#bound(lowerBound, upperBound),
          direction
        );

      // run callback with current value
      request.onsuccess = () => {
        let cursor = request.result;
        if (cursor) {
          cursor.advance( (callback && callback(cursor)) || 1 );
        }
        else {
          resolve(true);
        }
      };

      request.onerror = () => reject(request.error);

    });

  }


  /**
   * deletes all database stores and data
   * @returns {Promise} - resolves/rejects when database has been deleted
   */
  drop() {

    return new Promise((resolve, reject) => {

      this.close();
      const request = indexedDB.deleteDatabase( this.#dbName );

      request.onsuccess = () => {
        this.#dbName = null;
        this.#dbVersion = null;
        resolve(true);
      };
      request.onerror = () => reject(false);

    });

  }


  /**
   * PRIVATE: return new transaction and object store/index
   * @private
   * @param {string} storeName - store to use (required)
   * @param {string} indexName - index to use (optional)
   * @param {boolean} write - true for write access, false for read-only (the default)
   * @return {object} ret - transaction and store/index objects
   * @return {IDBTransaction} ret.transaction - transaction object
   * @return {*} ret.store - a IDBObjectStore or IDBIndex object
   */
  #query(storeName, indexName, write) {

    const
      transaction = this.#db.transaction(
        storeName,
        write ? 'readwrite' : 'readonly',
        { durability: write ? 'strict' : 'default'}
      ),
      store = transaction.objectStore(storeName);

    return ({
      transaction,
      store: indexName && !write ? store.index(indexName) : store
    });

  }


  /**
   * PRIVATE: return new key range bound
   * @private
   * @param {*} lowerBound - lower boundary key
   * @param {*} upperBound - upper boundary key
   * @returns {IDBKeyRange} - key range object
   */
  #bound(lowerBound, upperBound) {

    let bound;
    if (lowerBound && upperBound) bound = IDBKeyRange.bound(lowerBound, upperBound);
    else if (lowerBound) bound = IDBKeyRange.lowerBound(lowerBound);
    else if (upperBound) bound = IDBKeyRange.upperBound(upperBound);

    return bound;

  }

}
