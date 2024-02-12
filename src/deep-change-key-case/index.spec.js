import { camelCase } from 'camel-case'

import self from './index.js'

export default {
  array: () =>
    expect(
      self(
        [
          { bar_baz: 2, foo_bar: 1 },
          { test_bar: 5, test_foo: 4 },
        ],
        camelCase,
      ),
    ).toEqual([
      { barBaz: 2, fooBar: 1 },
      { testBar: 5, testFoo: 4 },
    ]),
  object: () =>
    expect(self({ bar_baz: 2, foo_bar: 1 }, camelCase)).toEqual({
      barBaz: 2,
      fooBar: 1,
    }),
}
