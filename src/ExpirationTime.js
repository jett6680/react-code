import React from 'react';

const MAX_SIGNED_31_BIT_INT = 1073741823

const NoWork = 0;
const Sync = 1;
const Never = MAX_SIGNED_31_BIT_INT;

const UNIT_SIZE = 10;
const MAGIC_NUMBER_OFFSET = 2;

// 1 unit of expiration time represents 10ms.
function msToExpirationTime(ms) {
  // Always add an offset so that we don't clash with the magic number for NoWork.
  return ((ms / UNIT_SIZE) | 0) + MAGIC_NUMBER_OFFSET;
}

function expirationTimeToMs(expirationTime) {
  return (expirationTime - MAGIC_NUMBER_OFFSET) * UNIT_SIZE;
}

function ceiling(num, precision) {
  return (((num / precision) | 0) + 1) * precision;
}

function computeExpirationBucket(
    currentTime,
    expirationInMs,
    bucketSizeMs,
) {
  return (
      MAGIC_NUMBER_OFFSET +
      ceiling(
          currentTime - MAGIC_NUMBER_OFFSET + expirationInMs / UNIT_SIZE,
          bucketSizeMs / UNIT_SIZE,
      )
  );
}

const LOW_PRIORITY_EXPIRATION = 5000;
const LOW_PRIORITY_BATCH_SIZE = 250;

function computeAsyncExpiration(
    currentTime,
) {
  return computeExpirationBucket(
      currentTime,
      LOW_PRIORITY_EXPIRATION,
      LOW_PRIORITY_BATCH_SIZE,
  );
}

// We intentionally set a higher expiration time for interactive updates in
// dev than in production.
//
// If the main thread is being blocked so long that you hit the expiration,
// it's a problem that could be solved with better scheduling.
//
// People will be more likely to notice this and fix it with the long
// expiration time in development.
//
// In production we opt for better UX at the risk of masking scheduling
// problems, by expiring fast.
const HIGH_PRIORITY_EXPIRATION = __DEV__ ? 500 : 150;
const HIGH_PRIORITY_BATCH_SIZE = 100;

function computeInteractiveExpiration(currentTime) {
  return computeExpirationBucket(
      currentTime,
      HIGH_PRIORITY_EXPIRATION,
      HIGH_PRIORITY_BATCH_SIZE,
  );
}
const date = Date.now()

console.log('date', date)
console.log('computeAsyncExpiration', computeAsyncExpiration(date))
console.log('computeInteractiveExpiration', computeInteractiveExpiration(date))

setTimeout(() => {
  const date1 = Date.now()

  console.log('date1', date1)
  console.log('computeAsyncExpiration', computeAsyncExpiration(date1))
  console.log('computeInteractiveExpiration', computeInteractiveExpiration(date1))
}, 11)


export default function () {
  return <div>11111</div>
}
