/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var d3 = require('d3');

var Registry = require('../../registry');
var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');
var Color = require('../color');
var Drawing = require('../drawing');
var svgTextUtils = require('../../lib/svg_text_utils');

var dragElement = require('../dragelement');
var setCursor = require('../../lib/setcursor');

// var constants = require('../shapes/constants');
var shapeHelpers = require('../shapes/helpers');

var Fx = require('../fx');
var FxHover = require('../fx/hover');
var FxConstants = require('../fx/constants');
var FxHelpers = require('../fx/helpers');

// size and display constants for hover text
var HOVERARROWSIZE = FxConstants.HOVERARROWSIZE;
var HOVERTEXTPAD = FxConstants.HOVERTEXTPAD;

var loggersModule = require('../../lib/loggers');

var isNumeric = require('fast-isnumeric');
var getTraceColor = require('../../traces/scatter/get_trace_color');

var CURSOR_GROUP_CLASS = 'tracecursor_group';
var CURSOR_AXIS_LABEL_CLASS = 'tracecursor_axis_label';
var CURSOR_FLAG_CLASS = 'tracecursor_flag';

var supportedAxisTypes = ['linear', 'date', 'log', 'category'];

// tracecursors are stored in gd.layout.tracecursors, an array of objects
// index can point to one item in this array,
//  or non-numeric to simply add a new one
//  or -1 to modify all existing
// opt can be the full options object, or one key (to be set to value)
//  or undefined to simply redraw
// if opt is blank, val can be 'add' or a full options object to add a new
//  tracecursor at that point in the array, or 'remove' to delete this one

module.exports = {
    draw: draw,
    drawOne: drawOne,
    updateTraceCursor: updateFlags
};

function draw(gd) {
    var fullLayout = gd._fullLayout;

    // Remove previous tracecursors before drawing new in tracecursors in fullLayout.tracecursors

    var sel = gd._fullLayout._paperdiv.selectAll('.' + CURSOR_GROUP_CLASS);
    if(sel.size() !== fullLayout.tracecursors.length) {
        sel.remove();
    }

    for(var i = 0; i < fullLayout.tracecursors.length; i++) {
        drawOne(gd, i);
    }
}

function isInRange(x, cursorXAxis) {
    var dd = {};
    dd.x = getXValueAsNumber(x, cursorXAxis).xVal;
    return cursorXAxis.isPtWithinRange(dd, cursorXAxis.calendar);
}

function updateFlags(gd, index, yValues) {

    var tracecursorOptions = gd._fullLayout.tracecursors[index];

    var selector = '#cursorGroup_' + index;
    var cursorGroup = d3.select(selector);
    createLabels(gd, tracecursorOptions, cursorGroup, yValues);
}

function getXValueAsNumber(xVal, cursorXAxis) {
    var xxx = xVal;
    var convert = false;

    if(!isNumeric(xVal) && cursorXAxis.type === 'date') {
        var calendar = cursorXAxis.calendar;
        xxx = cursorXAxis.d2c(xVal, 0, calendar);
        convert = true;
    }

    var result = {
        xVal: xxx,
        convert: convert
    };

    return result;
}

function fixXValue(x, cursorXAxis) {

    var xMin;
    var xMax;
    var xval = x;

    var convert = false;

    var result = getXValueAsNumber(x, cursorXAxis);

    xval = result.xVal;
    convert = result.convert;

    if(isInRange(xval, cursorXAxis)) {
        if(convert) {
            xval = cursorXAxis.c2d(xval);
        }
        return xval;
    }

    if(cursorXAxis._rl) {
        xMin = cursorXAxis._rl[0];
        xMax = cursorXAxis._rl[1];
    } else {
        xMin = cursorXAxis.range[0];
        xMax = cursorXAxis.range[1];
    }

    if(xval < xMin) {
        xval = xMin;
    }

    if(xval > xMax) {
        xval = xMax;
    }

    if(convert) {
        xval = cursorXAxis.c2d(xval);
    }
    return xval;
}

function drawOne(gd, index) {
    // remove the existing tracecursor if there is one.
    // because indices can change, we need to look in all tracecursor layers
    gd._fullLayout._paperdiv
        .selectAll('.tracecursorlayer [data-index="' + index + '"]')
        .remove();

    var optionsIn = (gd.layout.tracecursors || [])[index],
        tracecursorOptions = gd._fullLayout.tracecursors[index];

    // this tracecursor is gone - quit now after deleting it
    // TODO: use d3 idioms instead of deleting and redrawing every time
    if(!optionsIn) return;

    var hasCartesian = gd._fullLayout._has('cartesian');

    if(!hasCartesian) {
        return;
    }

    drawTracecursor(index);

    function isAxisSupported(axisType) {

        for(var i = 0; i < supportedAxisTypes.length; i++) {
            if(supportedAxisTypes[i] === axisType) {
                return true;
            }
        }
        return false;
    }

    function drawTracecursor(index) {

        var tracecursorLayer = gd._fullLayout._tracecursorUpperLayer;

        var cursorXAxis = Axes.getFromId(gd, tracecursorOptions.xref);
        var axisType = cursorXAxis.type;


        if(!isAxisSupported(axisType)) {
            loggersModule.warn('Cursors are not supported for such type of X data');
            return;
        }

        var id = 'cursorGroup_' + index;
        var attrs = {
            'data-index': index,
            'fill-rule': 'evenodd',
            d: getPathString(gd, tracecursorOptions)
        };

        var cursorGroup = Lib.ensureSingleById(tracecursorLayer, 'g', id);
        cursorGroup.classed(CURSOR_GROUP_CLASS, true);
        cursorGroup.attr({'xref': tracecursorOptions.xref});

        // Don't show common label and flags if the cursor itself is not visible
        if(!isInRange(tracecursorOptions.x, cursorXAxis)) {
            cursorGroup.selectAll('g.' + CURSOR_AXIS_LABEL_CLASS).remove();
            cursorGroup.selectAll('g.' + CURSOR_FLAG_CLASS).remove();
            return;
        }

        var lineColor = tracecursorOptions.line.width ? tracecursorOptions.line.color : 'rgba(0,0,0,0)';
        var path = cursorGroup.append('path')
            .attr(attrs)
            .style('opacity', tracecursorOptions.opacity)
            .call(Color.stroke, lineColor)
            .call(Color.fill, tracecursorOptions.fillcolor)
            .call(Drawing.dashLine, tracecursorOptions.line.dash, tracecursorOptions.line.width);
        // SystemVision: To support context menu
        // .on("contextmenu", function (d, i) {
        //     d3.event.preventDefault();
        //     if(d3.event.button === 2) {
        //       console.log('right click')
        //     } else {
        //       console.log('left click')
        //     }
        //   });

        createLabels(gd, tracecursorOptions, cursorGroup, null);

        // SystemVision: Always support dragging
        if(tracecursorOptions.cursorMode !== 'frozen') {
            setupDragElement(gd, path, tracecursorOptions, index, cursorGroup);
        }
    }
}

function cleanPoint(d) {
    var index = d.index;
    var trace = d.trace || {};
    var cd0 = d.cd[0];
    var cd = d.cd[index] || {};

    var getVal = Array.isArray(index) ?
        function(calcKey, traceKey) {
            return Lib.castOption(cd0, index, calcKey) ||
                Lib.extractOption({}, trace, '', traceKey);
        } :
        function(calcKey, traceKey) {
            return Lib.extractOption(cd, trace, calcKey, traceKey);
        };

    function fill(key, calcKey, traceKey) {
        var val = getVal(calcKey, traceKey);
        if(val) d[key] = val;
    }

    fill('hoverinfo', 'hi', 'hoverinfo');
    fill('color', 'hbg', 'hoverlabel.bgcolor');
    fill('borderColor', 'hbc', 'hoverlabel.bordercolor');
    fill('fontFamily', 'htf', 'hoverlabel.font.family');
    fill('fontSize', 'hts', 'hoverlabel.font.size');
    fill('fontColor', 'htc', 'hoverlabel.font.color');
    fill('nameLength', 'hnl', 'hoverlabel.namelength');

    d.posref = d.ya._offset + (d.y0 + d.y1) / 2;

    // then constrain all the positions to be on the plot
    d.x0 = Lib.constrain(d.x0, 0, d.xa._length);
    d.x1 = Lib.constrain(d.x1, 0, d.xa._length);
    d.y0 = Lib.constrain(d.y0, 0, d.ya._length);
    d.y1 = Lib.constrain(d.y1, 0, d.ya._length);

    // and convert the x and y label values into formatted text
    if(d.xLabelVal !== undefined) {
        d.xLabel = ('xLabel' in d) ? d.xLabel : Axes.hoverLabelText(d.xa, d.xLabelVal);
        d.xVal = d.xa.c2d(d.xLabelVal);
    }
    if(d.yLabelVal !== undefined) {
        d.yLabel = ('yLabel' in d) ? d.yLabel : Axes.hoverLabelText(d.ya, d.yLabelVal);
        d.yVal = d.ya.c2d(d.yLabelVal);
    }

    return d;
}


function setupDragElement(gd, tracecursorPath, tracecursorOptions, index, cursorGroup) {
    var MINWIDTH = 10,
        MINHEIGHT = 10;

    var update;
    var x0, astrX0;

    var xa = Axes.getFromId(gd, tracecursorOptions.xref);

    var convFunc = getConvertFunction(gd, tracecursorOptions);

    var dragOptions = {
            element: tracecursorPath.node(),
            gd: gd,
            prepFn: startDrag,
            doneFn: endDrag,
            curX: tracecursorOptions.x
        },
        dragBBox = dragOptions.element.getBoundingClientRect();

    dragElement.init(dragOptions);

    tracecursorPath.node().onmousemove = updateDragMode;

    function updateDragMode(evt) {
        // choose 'move' or 'resize'
        // based on initial position of cursor within the drag element
        var w = dragBBox.right - dragBBox.left,
            h = dragBBox.bottom - dragBBox.top,
            x = evt.clientX - dragBBox.left,
            y = evt.clientY - dragBBox.top,
            cursor = (w > MINWIDTH && h > MINHEIGHT && !evt.shiftKey) ?
                dragElement.getCursor(x / w, 1 - y / h) :
                'move';

        setCursor(tracecursorPath, cursor);
    }

    function startDrag(evt) {
        tracecursorOptions.x = fixXValue(tracecursorOptions.x, xa);

        x0 = convFunc.x2p(tracecursorOptions.x);
        astrX0 = 'tracecursors[' + index + ']' + '.x';

        update = {};

        // setup dragMode and the corresponding handler
        updateDragMode(evt);
        dragOptions.moveFn = movetracecursor;
    }

    function endDrag() {
        if(tracecursorOptions.cursorMode === 'frozen') {
            return;
        }
        setCursor(tracecursorPath);

        Registry.call('relayout', gd, update).then(function() {
            var eventData = {
                index: index,
                tracecursor: tracecursorOptions._input,
                fullTracecursor: tracecursorOptions,
                event: d3.event
            };

            // if(subplotId) {
            //     eventData.subplotId = subplotId;
            // }

            gd.emit('plotly_stopcursordrag', eventData);

        });
    }

    function movetracecursor(dx) {
        if(tracecursorOptions.cursorMode === 'frozen') {
            return;
        }

        if(tracecursorOptions.type === 'line') {

            var newX = convFunc.p2x(x0 + dx);
            newX = fixXValue(newX, xa);

            if(newX !== null && newX !== undefined) {
                update[astrX0] = tracecursorOptions.x = newX;
            }
        }

        tracecursorPath.attr('d', getPathString(gd, tracecursorOptions));

        createLabels(gd, tracecursorOptions, cursorGroup, null);
    }
}

function getConvertFunction(gd, tracecursorOptions) {

    var xa = Axes.getFromId(gd, tracecursorOptions.xref);

    var x2r, x2p;
    var p2x;


    if(xa) {
        x2r = shapeHelpers.shapePositionToRange(xa);
        x2p = function(v) { return xa._offset + xa.r2p(x2r(v, true)); };

        p2x = shapeHelpers.getPixelToData(gd, xa);
    }

    if(xa && xa.type === 'date') {
        x2p = shapeHelpers.decodeDate(x2p);
    }

    var convFunc = {
        x2p: x2p,
        p2x: p2x
    };

    return convFunc;
}

function getPathString(gd, tracecursorOptions) {

    var xa = Axes.getFromId(gd, tracecursorOptions.xref);

    var convFunc = getConvertFunction(gd, tracecursorOptions);

    var x0, x1;
    x0 = x1 = convFunc.x2p(tracecursorOptions.x);

    var y0 = xa._counterSpan[0];
    var y1 = xa._counterSpan[1];

    return 'M' + x0 + ',' + y0 + 'L' + x1 + ',' + y1;

}

function createLabelText(hoverData, opts, gd, tracecursorOptions, cursorGroup) {
    var bgColor = opts.bgColor;
    var container = cursorGroup;// opts.container;
    var outerContainer = opts.outerContainer;
    var commonLabelOpts = opts.commonLabelOpts || {};
    var showCommonLabel = true;

    // opts.fontFamily/Size are used for the common label
    // and as defaults for each hover label, though the individual labels
    // can override this.
    var fontFamily = opts.fontFamily || FxConstants.HOVERFONT;
    var fontSize = opts.fontSize || FxConstants.HOVERFONTSIZE;

    var xa = Axes.getFromId(gd, tracecursorOptions.xref);

    var yId = xa.anchor;

    var ya = Axes.getFromId(gd, yId);

    var convFunc = getConvertFunction(gd, tracecursorOptions);

    var x0 = convFunc.x2p(tracecursorOptions.x);

    var result = getXValueAsNumber(tracecursorOptions.x, xa);
    var xLabelValue = result.xVal;

    var xAxisLabelText = Axes.hoverLabelText(xa, xLabelValue);

    var outerContainerBB = outerContainer.node().getBoundingClientRect();
    var outerTop = outerContainerBB.top;
    var outerWidth = outerContainerBB.width;

    var commonLabel = cursorGroup.selectAll('g.' + CURSOR_AXIS_LABEL_CLASS)
        .data(showCommonLabel ? [0] : []);
    commonLabel.enter().append('g')
        .classed(CURSOR_AXIS_LABEL_CLASS, true);
    commonLabel.exit().remove();

    commonLabel.each(function() {
        var label = d3.select(this);
        var lpath = Lib.ensureSingle(label, 'path', null, function(s) {
            s.style({ 'stroke-width': '1px' });
        });

        var ltext = Lib.ensureSingle(label, 'text', null, null);


        lpath.style({
            fill: commonLabelOpts.bgcolor || Color.defaultLine,
            stroke: commonLabelOpts.bordercolor || Color.background,
        });


        ltext.text(xAxisLabelText)
            .attr('label-value', xLabelValue)
            .attr('label-date', tracecursorOptions.x)
            .call(Drawing.font,
                commonLabelOpts.font.family || fontFamily,
                commonLabelOpts.font.size || fontSize,
                commonLabelOpts.font.color || Color.background
            )
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        label.attr('transform', '');

        var tbb = ltext.node().getBoundingClientRect();

        var topsign = xa.side === 'top' ? '-' : '';
        lpath.attr('d', 'M0,0' +
                'L' + HOVERARROWSIZE + ',' + topsign + HOVERARROWSIZE +
                'H' + (HOVERTEXTPAD + tbb.width / 2) +
                'v' + topsign + (HOVERTEXTPAD * 2 + tbb.height) +
                'H-' + (HOVERTEXTPAD + tbb.width / 2) +
                'V' + topsign + HOVERARROWSIZE + 'H-' + HOVERARROWSIZE + 'Z');

        ltext.attr('text-anchor', 'middle')
                .call(svgTextUtils.positionText, 0, (xa.side === 'top' ?
                    (outerTop - tbb.bottom - HOVERARROWSIZE - HOVERTEXTPAD) :
                    (outerTop - tbb.top + HOVERARROWSIZE + HOVERTEXTPAD)));
        label.attr('transform', 'translate(' +
                (x0) + ',' +
                (ya._offset + (xa.side === 'top' ? 0 : ya._length)) + ')');
    });

    // show all the individual labels

    // first create the objects
    var hoverLabels = container.selectAll('g.' + CURSOR_FLAG_CLASS)
        .data(hoverData, function(d) {
            return [d.trace.index, d.index, d.x0, d.y0, d.name, d.attr, d.xa, d.ya || ''].join(',');
        });
    hoverLabels.enter().append('g')
        .classed(CURSOR_FLAG_CLASS, true)
        .each(function() {
            var g = d3.select(this);
            // trace name label (rect and text.name)
            g.append('rect')
                .call(Color.fill, Color.addOpacity(bgColor, 0.8));
            g.append('text').classed('name', true);
            // trace data label (path and text.nums)
            g.append('path')
                .style('stroke-width', '1px');
            g.append('text').classed('nums', true)
                .call(Drawing.font, fontFamily, fontSize);
        });
    hoverLabels.exit().remove();

    // then put the text in, position the pointer to the data,
    // and figure out sizes
    hoverLabels.each(function(d) {
        var g = d3.select(this).attr('transform', ''),
            text = '';

        // combine possible non-opaque trace color with bgColor
        var baseColor = Color.opacity(d.color) ? d.color : Color.defaultLine;
        var traceColor = Color.combine(baseColor, bgColor);

        // find a contrasting color for border and text
        var contrastColor = d.borderColor || Color.contrast(traceColor);

        text = d.yLabel;
        // if 'text' is empty at this point, remove the label
        if(text === '') {
            g.remove();
        }

        // main label
        var tx = g.select('text.nums')
            .call(Drawing.font,
                d.fontFamily || fontFamily,
                d.fontSize || fontSize,
                d.fontColor || contrastColor)
            .text(text)
            .attr('data-notex', 1)
            .attr('label-value', d.yLabelVal)
            .call(svgTextUtils.positionText, 0, 0)
            .call(svgTextUtils.convertToTspans, gd);

        g.select('path')
            .style({
                fill: traceColor,
                stroke: contrastColor
            });
        var tbb = tx.node().getBoundingClientRect(),
            htx = d.xa._offset + (d.x0 + d.x1) / 2,
            hty = d.ya._offset + (d.y0 + d.y1) / 2,
            dx = Math.abs(d.x1 - d.x0),
            txTotalWidth = tbb.width + HOVERARROWSIZE + HOVERTEXTPAD,
            anchorStartOK,
            anchorEndOK;

        d.ty0 = outerTop - tbb.top;
        d.bx = tbb.width + 2 * HOVERTEXTPAD;
        d.by = tbb.height + 2 * HOVERTEXTPAD;
        d.anchor = 'start';
        d.txwidth = tbb.width;
        d.offset = 0;

        d.pos = hty;
        anchorStartOK = htx + dx / 2 + txTotalWidth <= outerWidth;
        anchorEndOK = htx - dx / 2 - txTotalWidth >= 0;
        if((d.idealAlign === 'left' || !anchorStartOK) && anchorEndOK) {
            htx -= dx / 2;
            d.anchor = 'end';
        } else if(anchorStartOK) {
            htx += dx / 2;
            d.anchor = 'start';
        } else d.anchor = 'middle';


        tx.attr('text-anchor', d.anchor);
        g.attr('transform', 'translate(' + htx + ',' + hty + ')');
    });

    var fullLayout = gd._fullLayout;

    FxHover.avoidOverlaps(hoverData, 'ya', fullLayout);
    FxHover.alignHoverLabels(hoverLabels, false);
    return hoverLabels;
}

function createLabels(gd, tracecursorOptions, cursorGroup, fixYValues) {

    var fullLayout = gd._fullLayout;
    var labelOpts = {
        hovermode: 'x',
        bgColor: Color.background || 'black',
        container: gd._fullLayout._tracecursorUpperLayer,
        outerContainer: fullLayout._paperdiv,
        commonLabelOpts: fullLayout.hoverlabel,
        hoverdistance: fullLayout.hoverdistance
    };

    var subplots = getCursorSubplots(gd, tracecursorOptions);

    var hoverData = initCursorData(gd, subplots, tracecursorOptions, fixYValues);
    createLabelText(hoverData, labelOpts, gd, tracecursorOptions, cursorGroup, subplots);
}

function getCursorSubplots(gd, tracecursorOptions) {
    var subplots = gd._fullLayout._subplots.cartesian;
    var cursorXAxis = Axes.getFromId(gd, tracecursorOptions.xref);
    var xAxisId = cursorXAxis._id;
    var subId = xAxisId + 'y';
    var arr = [];

    for(var i = 0; i < subplots.length; i++) {
        var subplot = subplots[i];
        if(subplot.indexOf(subId) !== -1) {
            arr.push(subplot);
        }
    }
    return arr;
}

function initCursorData(gd, subplot, tracecursorOptions, fixYValues) {
    if(!subplot) subplot = 'xy';

    // if the user passed in an array of subplots,
    // use those instead of finding overlayed plots
    var subplots = Array.isArray(subplot) ? subplot : [subplot];

    var fullLayout = gd._fullLayout;
    var plots = fullLayout._plots || [];
    var plotinfo = plots[subplot];

    // list of all overlaid subplots to look at
    if(plotinfo) {
        var overlayedSubplots = plotinfo.overlays.map(function(pi) {
            return pi.id;
        });

        subplots = subplots.concat(overlayedSubplots);
    }

    var len = subplots.length;
    var cursorXAxis = Axes.getFromId(gd, tracecursorOptions.xref);

    var yaArray = new Array(len);

    for(var i = 0; i < len; i++) {
        var spId = subplots[i];

        // 'cartesian' case
        var plotObj = plots[spId];
        if(plotObj) {

            // TODO make sure that fullLayout_plots axis refs
            // get updated properly so that we don't have
            // to use Axes.getFromId in general.

            yaArray[i] = Axes.getFromId(gd, plotObj.yaxis._id);
            continue;
        }

        // other subplot types
        var _subplot = fullLayout[spId]._subplot;
        yaArray[i] = _subplot.yaxis;
    }

    var distance = 10000;

    var hoverData = [],

        curvenum,
        cd,
        trace,
        subplotId,
        subploti,
        pointData;

    for(curvenum = 0; curvenum < gd.calcdata.length; curvenum++) {
        cd = gd.calcdata[curvenum];
        trace = cd[0].trace;
        if(subplots.indexOf(FxHelpers.getSubplot(trace)) === -1) {
            continue;
        }

        // filter out broken data
        if(!cd || !cd[0] || !trace) continue;


        subplotId = FxHelpers.getSubplot(trace);
        subploti = subplots.indexOf(subplotId);

        // container for new point, also used to pass info into module.hoverPoints
        pointData = {
            // trace properties
            cd: cd,
            trace: trace,
            xa: cursorXAxis,
            ya: yaArray[subploti],

            // point properties - override all of these
            index: false, // point index in trace - only used by plotly.js hoverdata consumers
            distance: distance,

            // where and how to display the hover label
            color: Color.defaultLine, // trace color
            name: trace.name,
            x0: undefined,
            x1: undefined,
            y0: undefined,
            y1: undefined,
            xLabelVal: undefined,
            yLabelVal: undefined,
            text: undefined
        };

        // SystemVision: If we use "date" in X axis, let be sure that we use x (as a time) in ms
        // So transfrom it from "2013-11-10 22:23:00" into 1384122180000, for example

        var result = getXValueAsNumber(tracecursorOptions.x, cursorXAxis);
        var xValue = result.xVal;

        // SystemVision: We do not use yval to find hoverPoints, so it can be set to arbitrary value
        var yValue = 0;

        // Now if there is range to look in, find the points to hover.
        var fixYValue = null;
        if(fixYValues !== null && fixYValues !== undefined) {
            fixYValue = fixYValues[trace.name];
        }

        var newPoints = hoverPoints(pointData, xValue, yValue, fixYValue);
        if(newPoints) {
            var newPoint;
            for(var newPointNum = 0; newPointNum < newPoints.length; newPointNum++) {
                newPoint = newPoints[newPointNum];
                if(isNumeric(newPoint.x0) && isNumeric(newPoint.y0)) {
                    hoverData.push(cleanPoint(newPoint, 'x'));
                }
            }
        }
    }

    function hoverPoints(pointData, xval, yval, fixYValue) {
        var cd = pointData.cd;
        var trace = cd[0].trace;
        var traceXAxis = pointData.xa;
        var traceYAxis = pointData.ya;

        var xpx = traceXAxis.c2p(xval);

        // find closest point by x
        var distfn = function(di) {
            var rad = Math.max(3, di.mrc || 0);
            var kink = 1 - 1 / rad;
            var dxRaw = Math.abs(traceXAxis.c2p(di.x) - xpx);
            var d = (dxRaw < rad) ? (kink * dxRaw / rad) : (dxRaw - rad + kink);
            return d;
        };

        var x0, y0, x1, y1, xx, yy;

        function getIntersectionPoint() {
            var lineShape = trace.line.shape;

            if(xx === x0) {
                return y0;
            }

            if(xx === x1) {
                return y1;
            }

            if(lineShape === 'hv') {
                if(xx < x1) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(lineShape === 'vh') {
                if(xx > x0) {
                    return y1;
                } else {
                    return y0;
                }
            }

            if(lineShape === 'hvh') {
                if(xx < (x0 + x1) / 2) {
                    return y0;
                } else {
                    return y1;
                }
            }

            if(lineShape === 'vhv') {
                if(xx > x0) {
                    return (y0 + y1) / 2;
                } else {
                    return y0;
                }
            }

            if(lineShape === 'linear') {
                return (xx - x0) * (y1 - y0) / (x1 - x0) + y0;
            }

            return null;
        }

        Fx.getClosest(cd, distfn, pointData);

        if(pointData.index !== false) { // skip the rest (for this trace) if we didn't find a close point

            // the closest data point
            var di = cd[pointData.index];

            var intersect = false;
            var exact = false;

            x0 = di.x;
            y0 = di.y;
            x1 = di.x;
            y1 = di.y;
            xx = traceXAxis.p2c(xpx);
            if(!isInRange(xx, traceXAxis)) {
                yy = null;
            } else {
                yy = di.y;

                var leftPoint = pointData.index;
                var rightPoint = pointData.index;
                if(pointData.distance < 0.0001) {
                    intersect = true;
                    exact = true;
                } else if(di.x > xx && pointData.index > 0) {
                    leftPoint = pointData.index - 1;
                    rightPoint = pointData.index;
                    intersect = true;
                } else if(di.x < xx && pointData.index < cd.length - 1) {
                    rightPoint = pointData.index + 1;
                    leftPoint = pointData.index;
                    intersect = true;
                }

                var dLeft = cd[leftPoint];
                x0 = dLeft.x;
                y0 = dLeft.y;
                var dRight = cd[rightPoint];
                x1 = dRight.x;
                y1 = dRight.y;


                if(intersect) {
                    if(exact) {
                        yy = y0;
                    } else {
                        yy = getIntersectionPoint();
                    }

                } else {
                    yy = null;
                }

                var xc = xpx;
                var yc = traceYAxis.c2p(yy);

                Lib.extendFlat(pointData, {
                    color: getTraceColor(trace, di),

                    x0: xc,
                    x1: xc,
                    xLabelVal: xx,

                    y0: yc,
                    y1: yc,
                    yLabelVal: yy
                });

                if(fixYValue !== null && fixYValue !== undefined) {
                    Lib.extendFlat(pointData, {
                        yLabel: fixYValue
                    });
                }

            }

            return [pointData];
        }
    }
    return hoverData;
}
