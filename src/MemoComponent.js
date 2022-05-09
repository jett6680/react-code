import React from 'react'

const MemoComponent = () => {
  return (
    <div>
      <input type="text" defaultValue="22" ></input>
    </div>
  )
}

export default React.memo(MemoComponent)
