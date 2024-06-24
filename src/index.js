import { mapValues, omitBy } from '@dword-design/functions';
import camelcaseKeys from 'camelcase-keys';
import mysql from 'mysql2/promise';
import snakecaseKeys from 'snakecase-keys';

export default {
  ...mysql,
  createPool: options => {
    const result = mysql.createPool({
      ...options,
      multipleStatements: true,
      namedPlaceholders: true,
    });

    const oldQuery = result.query;

    result.query = async function (...args) {
      if (args.length > 1) {
        args[1] = Array.isArray(args[1])
          ? args[1].map(arg =>
              typeof arg === 'object' ? snakecaseKeys(arg) : arg,
            )
          : snakecaseKeys(args[1]);
      }

      let [statementsRows, statementsColumns] = await oldQuery.call(
        this,
        ...args,
      );

      const hasMultipleStatements =
        Array.isArray(statementsColumns) &&
        statementsColumns.every(
          column => column === undefined || Array.isArray(column),
        );

      if (!hasMultipleStatements) {
        statementsRows = [statementsRows];
        statementsColumns = [statementsColumns];
      }

      statementsRows = statementsRows.map((rows, statementIndex) =>
        Array.isArray(rows)
          ? rows.map(row =>
              camelcaseKeys(
                row
                  |> omitBy(value => value === null || value === undefined)
                  |> mapValues((value, name) => {
                    const column = statementsColumns[statementIndex].find(
                      _column => _column.name === name,
                    );

                    return column.columnType === mysql.Types.TINY &&
                      column.columnLength === 1
                      ? !!value
                      : value;
                  }),
                { deep: true },
              ),
            )
          : rows,
      );

      return statementsRows?.length === 1 ? statementsRows[0] : statementsRows;
    };

    result.queryOne = async (...args) => (await result.query(...args))[0];
    return result;
  },
};
