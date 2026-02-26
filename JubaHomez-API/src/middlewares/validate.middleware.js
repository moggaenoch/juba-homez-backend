const { fail } = require("../utils/responses");

function validate(schema, property = "body") {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(fail(400, "Validation error", error.details.map(d => d.message)));
    }
    req[property] = value;
    next();
  };
}

module.exports = { validate };
