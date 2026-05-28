const noop = () => {};

export const Accelerometer = {
  addListener: () => ({ remove: noop }),
  removeAllListeners: noop,
  setUpdateInterval: noop,
  isAvailableAsync: async () => false,
};
