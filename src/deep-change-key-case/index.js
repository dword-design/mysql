import { isPlainObject } from 'lodash-es'

const result = (value, fn) => {
  if (Array.isArray(value)) {
    return value.map(v => result(v, fn))
  }
  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [k, v]) => {
      acc[fn(k)] = result(v, fn)

      return acc
    }, {})
  }

  return value
}

export default result
