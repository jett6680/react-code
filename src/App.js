import React from 'react'
// import LifeCycles from './LifeCycles'
// import HookComponents from './Hook'
// import ClassComponents from './Class'
import ParentComponent from './ParentComponent'
import ChildComponent from './ChildComponent'

export default class App extends React.Component {

  constructor() {
    super()
  }

  render() {
    return (
      <div className="app-component-wrap">
        <ParentComponent>
          <ChildComponent />
        </ParentComponent>
      </div>
    )
  }
}
