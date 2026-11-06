// Pin the timezone so week bucketing is deterministic in every environment.
module.exports = async () => {
  process.env.TZ = 'UTC';
};
