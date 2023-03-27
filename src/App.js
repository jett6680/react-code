import * as React from 'react'

function FunctionCom() {
  console.log(React.useId())
  return (
      <div>FunctionCom</div>
  )
}

export default class App extends React.Component {

  constructor() {
    super()
    this.state = {
      count: 0
    }
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    setTimeout(() => {

      this.setState({
        count: 1
      })

      this.setState({
        count: 2
      })

      this.setState({
        count: 3
      })

    }, 0)
  }

  render() {
    console.log('render', this.state.count)
    return (
        <div className="app-component-wrap">
          hello world { this.state.count }
          <button onClick={this.handleClick}>点击</button>
          <FunctionCom />
        </div>
    )
  }
}
