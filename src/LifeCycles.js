import React from 'react'

export default class LifeCycles extends React.Component {

  constructor() {
    super();
    this.state = {
      list: ['a', 'b', 'c', 'd']
    }
    console.log('constructor')
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

  handleClick() {
    this.setState({
      list: ['a', 'c', 'd', 'b']
    })
  }

  render() {
    console.log('render')
    const { list } = this.state
    return (
      <div>
        <ul>
          {
            list.map(item => <li key={item}>{item}</li>)
          }
        </ul>
        <button onClick={this.handleClick.bind(this)}>change</button>
      </div>
    )
  }
}
