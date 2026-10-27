'use client';
import {Component, Suspense, lazy, useState, type ComponentType, type ReactNode} from 'react';
import {FeedbackActionButton} from '../action-feedback';
import {toolbarLocale} from '../standard-toolbar/translations';

const words=()=>toolbarLocale()==='zh'
 ? {loading:'正在載入畫面…',error:'無法載入畫面。請重試。',retry:'重試'}
 : toolbarLocale()==='en'
 ? {loading:'Loading screen…',error:'Could not load the screen. Please retry.',retry:'Retry'}
 : {loading:'Đang tải giao diện…',error:'Không tải được giao diện. Vui lòng thử lại.',retry:'Thử lại'};

class ScreenBoundary extends Component<{children:ReactNode;retry:()=>void},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){const t=words();return this.state.failed
  ? <div role="alert">{t.error} <FeedbackActionButton type="button" onClick={this.props.retry}>{t.retry}</FeedbackActionButton></div>
  : this.props.children;}
}

// Defined once at module scope, so background refreshes never replace a loaded
// screen or its draft. A failed chunk can be retried without reloading the page.
export function deferredScreen<Props extends object>(load:()=>Promise<{default:ComponentType<Props>}>) {
 const Initial=lazy(load);
 return function DeferredScreen(props:Props){
  const [screen,setScreen]=useState(()=>({View:Initial,attempt:0}));
  const View=screen.View;
  return <ScreenBoundary key={screen.attempt} retry={()=>setScreen(current=>({View:lazy(load),attempt:current.attempt+1}))}>
   <Suspense fallback={<div role="status" aria-live="polite">{words().loading}</div>}><View {...props}/></Suspense>
  </ScreenBoundary>;
 };
}
