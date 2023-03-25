import React from "react"

class DidMountSetState extends React.Component {

  constructor() {
    super();
    this.state = {
      count: 1
    }
  }

  componentDidMount() {
    this.setState({
      count: 3
    }, () => {
      console.log('---')
    })
  }

  render() {
    return (
        <div>
          { this.state.count }
        </div>
    );
  }
}


export default DidMountSetState
