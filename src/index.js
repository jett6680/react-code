import * as React from 'react';

console.log(React, 'index.js')
import {  createRoot } from 'react-dom/client';
// import List from './List'
// import Suspense from './Suspense'
// import MemoComponent from './MemoComponent'
import App from './App'

createRoot(document.getElementById('root')).render(<App />)


