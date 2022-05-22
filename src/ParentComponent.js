import React from 'react'


class ParentComponent extends React.Component {
  constructor() {
    super()
    this.state = {
      value: '111'
    }
  }
  handleClick(e) {
    console.log(e._dispatchListeners)
    console.log(e.dispatchConfig)
    console.log('---')
  }

  handleChange() {
    this.setState({
      value: '222'
    })
  }

  render() {
    return (
      <div className='parent-component'>
        <div onClick={this.handleClick.bind(this)}>
          ParentComponent 
        </div>
        <button onClick={this.handleClick.bind(this)}>点击</button> 
        <input type="text" value={this.state.value} onChange={this.handleChange.bind(this)} />
        {
          this.props.children
        }
      </div> 
    )
  }
}

export default ParentComponent