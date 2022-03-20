import React, { Suspense } from 'react';
const OtherComponent = React.lazy(() => import('./demo2'))

window.setTimeout(() => {
  console.log('setTimeout')
}, 0)
console.log(Date.now(), '--')
window.requestAnimationFrame((timestamp) => {
  console.log(Date.now())
  console.log('requestAnimationFrame', timestamp)
})

window.requestIdleCallback(() => {
  console.log('requestIdleCallback')
})


export default class IdeaCallback extends React.Component {
  state = {
    a: 2
  }

  handle() {
    this.setState({
      a: this.state.a + 1
    })
  }

  render() {
    return (
      <div> 
        <button onClick={this.handle.bind(this)}>点我</button>
        { this.state.a } 
        <Suspense fallback={<div>Loading...</div>}>
          <OtherComponent />
        </Suspense>
      </div>
    )
  }
}