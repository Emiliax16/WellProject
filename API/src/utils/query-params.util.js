const getPaginationParameters = (query) => {
  const limit = query.size ? parseInt(query.size, 10) : 25;
  const page = query.page ? parseInt(query.page, 10) : 0;
  const offset = (page) * limit;
  return { limit, offset };
};

module.exports = getPaginationParameters;