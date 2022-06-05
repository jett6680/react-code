import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo
} from 'react'

export default function Hook() {

  let [count, setCount] = useState(100)

  const increase = useCallback(function () {
    setCount(count + 1)
  }, [count])

  useEffect(() => {
    const dom = document.getElementById('test')
    console.log('useEffect create', dom)
    return () => {
      console.log('useEffect destoryed')
    }
  })

  useLayoutEffect(() => {
    const dom = document.getElementById('test')
    console.log('useLayoutEffect create', dom)
    return () => {
      console.log('useLayoutEffect destoryed')
    }
  })

  return (
    <div id="test">
      <span>{count}</span>
      <button onClick={increase}>increase</button>
    </div>
  )
}
