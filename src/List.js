import React, { unstable_ConcurrentMode as ConcurrentMode } from 'react'

export default class App extends React.Component {

  constructor() {
    super()
    this.state = {
      // list: ['a', 'b', 'c', 'd']
      showText: false
    }
  }

  componentDidMount() {
    console.log('-===')
  }

  handleClick() {
    this.setState({
      showText: !this.state.showText
    })
  }

  render() {
    return (
      <ConcurrentMode>
        <div className="app-wrap">
          <div hidden={this.state.showText}>
            zdfsdasd
          </div>
          {/*<div>*/}
          {/*  {*/}
          {/*    this.state.showText ? <div>sss</div> : 'asdasd'*/}
          {/*  }*/}
          {/*</div>*/}
          {/*<div className='app-list'>*/}
          {/*  {*/}
          {/*    this.state.list.map(item => <div key={item}> { item } ===</div>)*/}
          {/*  }*/}
          {/*</div>*/}
          <button onClick={this.handleClick.bind(this)}>
            点击
          </button>

        </div>
      </ConcurrentMode>

    )
  }
}
