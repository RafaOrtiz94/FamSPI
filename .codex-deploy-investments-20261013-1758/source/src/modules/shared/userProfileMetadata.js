const { PROFILE_SYNC_KEYS } = require("./profileSync");

const HR_PROFILE_METADATA_PATHS = PROFILE_SYNC_KEYS;

const getNestedValue = (source, path) =>
  path.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    source,
  );

const setNestedValue = (target, path, value) => {
  let ref = target;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      ref[key] = value;
      return;
    }

    if (!ref[key] || typeof ref[key] !== "object" || Array.isArray(ref[key])) {
      ref[key] = {};
    }
    ref = ref[key];
  });
};

const splitUserProfileMetadata = (metadata = {}) => {
  const ownMetadata = {};
  const collaboratorMetadata = {};

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (!HR_PROFILE_METADATA_PATHS.some((path) => path.startsWith(`${key}.`))) {
      ownMetadata[key] = value;
    }
  });

  HR_PROFILE_METADATA_PATHS.forEach((pathKey) => {
    const path = pathKey.split(".");
    const value = getNestedValue(metadata, path);
    if (value !== undefined) {
      setNestedValue(collaboratorMetadata, path, value);
    }
  });

  return {
    ownMetadata,
    collaboratorMetadata,
  };
};

module.exports = {
  splitUserProfileMetadata,
};
