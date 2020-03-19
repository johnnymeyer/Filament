//This is used to get the rectangle of an element [left,top,width,right]
window.getElementRect = function (element) {
    var rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height];
};
//This is called when the broswer is resized Sketch.Render.Web.Helpers.OnBrowserResize
window.resized = function () {
    // @ts-ignore
    DotNet.invokeMethodAsync("Sketch.Render.Web", "OnBrowserResize").then(data => data);
};
//Setup the event listener for the resize event
window.addEventListener("resize", window.resized);
//# sourceMappingURL=Helpers.js.map