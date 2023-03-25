import React, { useEffect, useLayoutEffect, useState } from "react"


function ChildrenFunctionComponent () {

  useEffect(() => {
    console.log('Children useEffect create')
    return () => {
      console.log('Children useEffect destory')
    }
  }, [])

  useLayoutEffect(() => {
    console.log('Children useLayoutEffect create')
    return () => {
      console.log('Children useLayoutEffect destory')
    }
  }, [])

  return (
    <div>Children FunctionComponent</div>
  )
}

function FunctionComponent () {

  const [ count, setCount ] = useState(0)

  useEffect(() => {
    console.log('useEffect create')
    return () => {
      console.log('useEffect destory')
    }
  }, [count])

  useLayoutEffect(() => {
    console.log('useLayoutEffect create')
    return () => {
      console.log('useLayoutEffect destory')
    }
  }, [count])

  return (
    <div>
      <div>FunctionComponent { count }</div>
      <button onClick={() => setCount(c => c + 1)}>点击</button>
    </div>
  )
}

class ChildrenClassComponent extends React.Component {
  componentWillUnmount() {
    console.log('Children componentWillUnmount')
  }
  render() {
    return (
      <div>ChildrenClassComponent</div>
    )
  }
}

class ClassComponent extends React.Component {
  constructor() {
    super()
    this.state = {}
  }
  static getDerivedStateFromProps() {
    console.log('getDerivedStateFromProps')
    return {}
  }

  componentDidMount() {
    console.log('componentDidMount')
  }

  shouldComponentUpdate() {
    console.log('shouldComponentUpdate')
    return true
  }

  getSnapshotBeforeUpdate() {
    console.log('getSnapshotBeforeUpdate')
    return null
  }

  componentDidUpdate() {
    console.log('componentDidUpdate')
  }

  componentWillUnmount() {
    console.log('componentWillUnmount')
  }

  componentDidCatch() {
    console.log('componentDidCatch')
  }

  render() {
    return (
      <div>
        <ChildrenClassComponent />
        <div>ClassComponent</div>
      </div>
    )
  }
}

class UNMount extends React.Component {
  constructor() {
    super()
    this.state = {
      visible: true
    }
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    this.setState({
      visible: false
    })
  }

  render() {
    return (
      <div>
        {
          this.state.visible ? (<FunctionComponent />) : <div>new Node</div>
        }

        <button onClick={this.handleClick}>点击</button>

      </div>
    )
  }
}

export default UNMount
