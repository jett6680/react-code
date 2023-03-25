import React, { useLayoutEffect, useState } from "react"

function UseLayoutEffectSetState() {
  const [count, setCount] = useState(0)

  useLayoutEffect(() => {
    setCount(2)
  }, [])

  return (
      <div>
        { count }
      </div>
  )
}

export default UseLayoutEffectSetState
