// PixDB testing
import { PixDB } from '../dist/pixdb.js';

log('initializing database');

const
  store = 'state',
  update = new Date();

let rec, count;

// ############# start tests #############

// initialize
const db = await new PixDB('test', 1, (init, oldVersion, newVersion) => {

  log(`upgrading database from ${ oldVersion } to ${ newVersion }`);

  switch (oldVersion) {

    case 0: {
      const state = init.createObjectStore(store, { keyPath: 'name' });
      state.createIndex('updateIdx', 'update', { unique: false });
      state.createIndex('expireIdx', 'expire', { unique: false });
    }

  }

});

// ----------------
// initial check
console.assert(db.isConnected, 'no database connection');
console.assert(db.name === 'test', `database has name: ${ db.name }`);
console.assert(db.version === 1, `database has version: ${ db.version }`);

log(`initial records in '${ store }': ${ await db.count({ store }) }`);

// ----------------
// clear existing records
await db.clear({ store });

count = await db.count({ store });
log(`\nafter clear - records in '${ store }': ${ count }`);
console.assert(count === 0, `'${ store }' does not have 0 records`);

// ----------------
// put six records
await db.put({ store, item: [
  { name: 'a', value: 1, update, expire: addDay(7, update) },
  { name: 'b', value: 'two', update, expire: addDay(6, update) },
  { name: 'c', value: [3,'three','tres'], update, expire: addDay(5, update) },
  { name: 'd', value: {item: 4, text: 'four'}, update, expire: addDay(4, update) },
  { name: 'e', value: true, update, expire: addDay(3, update) },
  { name: 'f', value: new Date(), update, expire: addDay(2, update) }
]});

// add single record
await db.add({ store, item: { name: 'g', value: 3.1415, update, expire: addDay(1, update) } });

// ----------------
// count records
count = await db.count({ store });
log(`after 7 updates - records in '${ store }': ${ count }`);
console.assert(count === 7, `'${ store }' does not have 7 records`);

// ----------------
// overwrite record - should fail
try {
  await db.add({ store, item: { name: 'a', value: 1, update, expire: addDay(7, update) } });
  console.assert(false, `'${ store }' overwrite should have failed`);
}
catch (e) {
  log(`record 'a' was not added to '${ store }' because the record exists\n${e}`);
}

// ----------------
// overwrite record - should pass
try {
  await db.put({ store, item: { name: 'a', value: 1, update, expire: addDay(7, update) } });
  log(`record 'a' was updated in '${ store }'`);
}
catch (e) {
  console.assert(false, `'${ store }' put should not have failed\n${e}`);
}

// ----------------
// delete a record
log('\ndelete a:', await db.delete({ store, key: 'a' }));
log('delete a again:', await db.delete({ store, key: 'a' }));

// ----------------
// count records
count = await db.count({ store });
log(`after one delete - records in '${ store }': ${ count }`);
console.assert(count === 6, `'${ store }' does not have 6 records`);

// ----------------
// delete multiple records
log('\ndelete a to c:', await db.deleteAll({ store, lowerBound: 'a', upperBound: 'c'  }));

// ----------------
// count records
count = await db.count({ store });
log(`after three deletes - records in '${ store }': ${ count }`);
console.assert(count === 4, `'${ store }' does not have 4 records`);

// ----------------
// add records back - should pass
try {
  await db.add({ store, item: [
    { name: 'a', value: 1, update, expire: addDay(7, update) },
    { name: 'b', value: 'two', update, expire: addDay(6, update) },
    { name: 'c', value: [3,'three','tres'], update, expire: addDay(5, update) }
  ] });
  log(`\n3 records were added to '${ store }'`);
}
catch (e) {
  console.assert(false, `'${ store }' add should not have failed\n${e}`);
}

// ----------------
// count records
count = await db.count({ store });
log(`after single add - records in '${ store }': ${ count }`);
console.assert(count === 7, `'${ store }' does not have 7 records`);

// ----------------
// get single record
rec = await db.get({ store, key: 'a' });
log('\nrecord a:', rec);
console.assert(rec.value === 1, `'${ store }' record 'a' value is not 1`);

// ----------------
// get single record by update index
rec = await db.get({ store, index: 'updateIdx', key: update });
log(`\nindexed record from ${ update }:`);
log(rec);
console.assert(rec.name === 'a', `'${ store }' record 'a' was not returned`);

// ----------------
// get all records as array
log('\nall records as array:');
rec = await db.getAll({ store });
rec.forEach( (r, i) => log(`[${ i }]:`, r.name, '=', r.value, '-', typeof r.value, Array.isArray(r.value) ? '(array)' : '') );
console.assert(rec.length === 7, `'${ store }' did not return 7 records`);

// ----------------
// return range of records
log('\nrange of records from b to e:');

rec = await db.getAll({ store, lowerBound: 'b', upperBound: 'e' });
rec.forEach( (r, i) => log(`[${ i }]:`, r.name, '=', r.value) );
console.assert(rec.length === 4, `'${ store }' range did not return 4 records`);

// ----------------
// return array of keys
log(`\n'${ store }' keys:`);
rec = await db.getAllKeys({ store });
log(rec);
console.assert(rec.length === 7, `'${ store }' did not return 7 keys`);

// ----------------
// get range of records by index
const
  exp = 3,
  upperBound = addDay(exp, update);
log(`\nindexed records to expire before ${ upperBound }:`);
rec = await db.getAll({ store, index: 'expireIdx', upperBound });
rec.forEach( (r, i) => log(`[${ i }]:`, r.name, '=', r.value) );
console.assert(rec.length === exp, `'${ store }' range did not return ${ exp } records`);

// ----------------
// all records ordered by expiry
log('\ncursor of indexed records ordered by expiry:');
let lastName = 'zzz';
await db.getCursor({ store, index: 'expireIdx', callback: cursor => {
  const r = cursor.value;
  log(r.expire, ':', r.name, '=', r.value);
  console.assert(lastName >= r.name, `incorrect order in '${ store }' expire index`);
  lastName = r.name;
} });

// ----------------
// close database
db.close();
log(`\ndatabase closed: ${ !db.isConnected }`);

console.assert(!db.isConnected, 'database connection open after close');

// ----------------
// reconnect to database
await db.connect();
log(`\ndatabase connected: ${ db.isConnected }`);
console.assert(db.isConnected, 'database connection closed after connect');

// ----------------
// randomly drop database
if (Math.random() > 0.5) {

  rec = await db.drop();
  log(`\ndatabase dropped: ${ rec }`);

}
else {

  db.close();

}

log(`\ndatabase closed: ${ !db.isConnected }`);
console.assert(!db.isConnected, 'database connection open after drop/close');

// ############# end of tests #############

// add days to current
function addDay(n, date) {

  const d = date ? new Date(date) : new Date();
  d.setUTCDate( n + d.getUTCDate() );
  return d;

}


// log to page
function log() {

  const msg = Array.from(arguments).map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  window.outputlog = window.outputlog || document.getElementById('outputlog');
  window.outputlog.textContent += msg +'\n';

}
