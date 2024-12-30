const ErrorHandler = require('./error.util');
const { wellDataDatesAreInvalid } = require('./errorcodes.util');

const defineDateCondition = (query) => {
  let { month, year } = query;
  let monthInt, yearInt;

  // Si no se proporcionan month y year, usamos el mes y año actuales
  if (!month || !year) {
    const currentDate = new Date();
    monthInt = currentDate.getMonth() + 1;
    yearInt = currentDate.getFullYear();
  } else {
    monthInt = parseInt(month, 10);
    yearInt = parseInt(year, 10);
  }

  if (
    !isNaN(monthInt) &&
    !isNaN(yearInt) &&
    monthInt >= 1 &&
    monthInt <= 12 &&
    yearInt >= 2023 &&
    yearInt <= new Date().getFullYear()
  ) {
    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 1);

    return { startDate, endDate };
  } else {
    throw new ErrorHandler(wellDataDatesAreInvalid);
  }
};

module.exports = defineDateCondition;
