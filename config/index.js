var ENV_DEVELOPMENT = "development";
var ENV_PRODUCTION = "production";

var configLoader = () => {
  if (process.env.NODE_ENV === ENV_PRODUCTION) {
    return `./${ENV_PRODUCTION}.js`;
  }
  if (process.env.NODE_ENV === ENV_DEVELOPMENT) {
    return `./${ENV_DEVELOPMENT}.js`;
  }
  return `./default.js`;
};

export default require(configLoader());
