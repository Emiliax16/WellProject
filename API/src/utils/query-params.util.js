const getPaginationParameters = (query) => {
  const limit = query.size ? parseInt(query.size, 10) : 1;
  const page = query.page ? parseInt(query.page, 10) : 25;
  const offset = (page - 1) * limit;
  return { limit, offset };
};

module.exports = getPaginationParameters;