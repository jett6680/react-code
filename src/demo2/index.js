import React from 'react'


class Input extends React.Component {
  state = {
    name: 'jett'
  }

  changeName(e) {
    this.setState({
      name: e.target.value
    })
  }

  render() {
    return (
      <input type="text" value={this.state.name} onChange={this.changeName.bind(this)} />
    )
  }
}

class List extends React.Component {
  state = {
    a: 2,
    b: 3,
    c: 4
  }

  clickEvent() {
    this.setState(oldState => {
      const { a, b, c } = oldState
      return {
        a: a * a,
        b: b * b,
        c: c * c
      }
    })
  }

  render() {
    const { a, b, c } = this.state
    return (
      [
        <span key={1} style={{ display: 'block' }}>{a}</span>,
        <span key={2} style={{ display: 'block' }}>{b}</span>,
        <span key={3} style={{ display: 'block' }}>{c}</span>,
        <button
          key={4}
          onClick={this.clickEvent.bind(this)}
          style={{ display: 'block' }}
          id="dom"
        >
          点击
        </button>
      ]
    )
  }
}

export default class Index extends React.Component {
  render() {
    return (
      <div>
        <Input />
        <List />
      </div>
    )
  }
}
