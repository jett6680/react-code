import React from 'react'
// import LifeCycles from './LifeCycles'
// import HookComponents from './Hook'
import ClassComponents from './Class'

export default class App extends React.Component {

  constructor() {
    super()
  }

  render() {
    return (
      <div className="app-component-wrap">
        <ClassComponents text="nihao ClassComponents" />
      </div>
    )
  }
}
