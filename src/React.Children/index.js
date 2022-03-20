/**
 * Created User: jett jindai.pjt@raycloud.com
 * Date Time: 2020/12/6 12:13
 * Description:
 */
import React from 'react'

class Child extends React.Component {
  render() {
    return <div>111</div>
  }
}

class Parent extends React.Component {
  render() {
    console.log(this.props.children)
    console.log(React.Children.map(this.props.children, c => [c,[c,c]]))
    return (
        <div>
          {this.props.children}
        </div>
    );
  }
}

export default class ReactChildren extends React.Component {
  render() {
    return (
        <Parent><Child /><Child /></Parent>
    );
  }
}
