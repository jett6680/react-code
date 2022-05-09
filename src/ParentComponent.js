import React from 'react'


class ParentComponent extends React.Component {
  render() {
    return (
      <div className='parent-component'>
        <div>
          ParentComponent 
        </div>
        {
          this.props.children
        }
      </div> 
    )
  }
}

export default ParentComponent