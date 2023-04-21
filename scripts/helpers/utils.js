const defaultSecondsToDelay = 60;

const delay = (ms = defaultSecondsToDelay * 1000) => {
  const minutes = ms / 1000;
  console.log(`Waiting for ${minutes} seconds.`);
  return new Promise((resolve) =>
    setTimeout(() => {
      console.log(`${minutes} seconds awaited`);
      resolve();
    }, ms)
  );
};

module.exports = {
  delay
};
