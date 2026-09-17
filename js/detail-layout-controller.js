(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyDetailLayoutController=api;
})(typeof window!=='undefined'?window:null,function(){
  function create(options){
    options=options||{};
    var win=options.window;
    var doc=options.document;
    var elements=options.elements||{};
    var detail=elements.detail||null;
    var tracksPanel=elements.tracksPanel||null;
    var marketplacePanel=elements.marketplacePanel||null;
    var about=elements.about||null;
    var infoCard=elements.infoCard||null;
    var desktopBreakpoint=Number(options.desktopBreakpoint)||1120;
    var mobileBreakpoint=Number(options.mobileBreakpoint)||760;
    var desktopRightColumn=null;
    var installed=false;

    if(!win||!doc)throw new Error('Detail layout controller requires window and document');

    function syncColumns(){
      if(!detail||!tracksPanel||!marketplacePanel||!about)return;
      var desktop=win.innerWidth>desktopBreakpoint;

      if(desktop){
        if(!desktopRightColumn){
          desktopRightColumn=doc.createElement('div');
          desktopRightColumn.className='album-desktop-right';
        }
        if(!desktopRightColumn.parentNode)detail.appendChild(desktopRightColumn);
        if(tracksPanel.parentNode!==desktopRightColumn)desktopRightColumn.appendChild(tracksPanel);
        if(marketplacePanel.parentNode!==desktopRightColumn)desktopRightColumn.appendChild(marketplacePanel);
        return;
      }

      if(desktopRightColumn&&tracksPanel.parentNode===desktopRightColumn){
        detail.insertBefore(tracksPanel,about);
      }
      if(desktopRightColumn&&marketplacePanel.parentNode===desktopRightColumn){
        if(about.nextSibling)detail.insertBefore(marketplacePanel,about.nextSibling);
        else detail.appendChild(marketplacePanel);
      }
      if(desktopRightColumn&&desktopRightColumn.parentNode){
        desktopRightColumn.parentNode.removeChild(desktopRightColumn);
      }
    }

    function syncDesktopHeight(){
      if(!detail)return;
      var main=detail.querySelector('.album-detail-main');
      var cover=detail.querySelector('.album-detail-cover');
      if(!main||!cover)return;

      if(win.innerWidth<=desktopBreakpoint){
        main.style.height='';
        main.style.maxHeight='';
        return;
      }

      var coverHeight=Math.floor(cover.getBoundingClientRect().height||0);
      if(coverHeight>0){
        main.style.height=coverHeight+'px';
        main.style.maxHeight=coverHeight+'px';
      }
    }

    function syncMobilePairHeight(){
      if(!infoCard)return;
      var cover=detail?detail.querySelector('.album-detail-cover'):null;
      var isMobile=win.matchMedia&&win.matchMedia('(max-width: '+mobileBreakpoint+'px)').matches;

      if(!isMobile||!cover){
        infoCard.style.height='';
        return;
      }

      infoCard.style.height='';
      var height=Math.round(cover.getBoundingClientRect().height||0);
      if(height>0)infoCard.style.height=height+'px';
    }

    function handleDesktopResize(){
      syncColumns();
      win.requestAnimationFrame(syncDesktopHeight);
    }

    function syncOpen(){
      win.requestAnimationFrame(function(){
        syncDesktopHeight();
        syncMobilePairHeight();
        win.requestAnimationFrame(function(){
          syncDesktopHeight();
          syncMobilePairHeight();
        });
      });
    }

    function install(){
      if(installed)return;
      installed=true;
      syncColumns();
      win.addEventListener('resize',handleDesktopResize,{passive:true});
      win.addEventListener('resize',syncMobilePairHeight,{passive:true});
      if(win.visualViewport)win.visualViewport.addEventListener('resize',syncMobilePairHeight,{passive:true});
    }

    function destroy(){
      if(!installed)return;
      installed=false;
      win.removeEventListener('resize',handleDesktopResize);
      win.removeEventListener('resize',syncMobilePairHeight);
      if(win.visualViewport)win.visualViewport.removeEventListener('resize',syncMobilePairHeight);
    }

    install();

    return Object.freeze({
      syncColumns:syncColumns,
      syncDesktopHeight:syncDesktopHeight,
      syncMobilePairHeight:syncMobilePairHeight,
      syncOpen:syncOpen,
      destroy:destroy
    });
  }

  return Object.freeze({create:create});
});
