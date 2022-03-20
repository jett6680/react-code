import React from 'react'

export default class ClassComponents extends React.Component {
  constructor() {
    super()
    this.state = {
      count: 100
    }
  }

  increase() {
    this.setState({
      count: this.state.count + 1
    })
  }

  reduce() {
    this.setState({
      count: this.state.count - 1
    })
  }

  render() {
    const { count } = this.state
    return (
      <div>
        <h5>ClassComponents {this.props.text}</h5>
        <span>{count}</span>
        <button 
          onClick={this.increase.bind(this)}
        >
          increase
        </button>
        <button 
          onClick={this.reduce.bind(this)}
        >
          reduce
        </button>
      </div>
    )
  }
}
