import * as React from 'react'
import { flushSync } from "react-dom";

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

      flushSync(() => {
        this.setState({
          count: 1
        })
      })

      flushSync(() => {
        this.setState({
          count: 2
        })
      })

      flushSync(() => {
        this.setState({
          count: 3
        })
      })

    }, 0)
  }

  render() {
    console.log('render', this.state.count)
    return (
        <div className="app-component-wrap">
          hello world { this.state.count }
          <button onClick={this.handleClick}>点击</button>
        </div>
    )
  }
}
