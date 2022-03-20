import React, { 
  useCallback, 
  useEffect, 
  useState, 
  useMemo 
} from 'react'

export default function Hook() {

  let [count, setCount] = useState(100)

  const increase = useCallback(function () {
    setCount(count + 1)
  }, [])

  return (
    <div>
      <span>{count}</span>
      <button onClick={increase}>increase</button>
    </div>
  )
}
