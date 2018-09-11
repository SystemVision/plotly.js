
var Tracecursors = require('@src/components/tracecursors');
var selectButton = require('../assets/modebar_button');
var Lib = require('@src/lib');
var isNumeric = require('fast-isnumeric');

var Plotly = require('@lib/index');
var Plots = require('@src/plots/plots');
var Axes = require('@src/plots/cartesian/axes');


var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var failTest = require('../assets/fail_test');
var drag = require('../assets/drag');
var getNodeCoords = require('../assets/get_node_coords');

var mouseEvent = require('../assets/mouse_event');

var DBLCLICKDELAY = require('../../../src/constants/interactions').DBLCLICKDELAY;

// var getClientPosition = require('../assets/get_client_position');

// var customAssertions = require('../assets/custom_assertions');

// var helpers = require('@src/components/shapes/helpers');
// var constants = require('@src/components/shapes/constants');


// var assertElemRightTo = customAssertions.assertElemRightTo;
// var assertElemTopsAligned = customAssertions.assertElemTopsAligned;
// var assertElemInside = customAssertions.assertElemInside;

// // Reusable vars
// var shapeTypes = [{type: 'rect'}, {type: 'circle'}, {type: 'line'}];
// var resizeDirections = ['n', 's', 'w', 'e', 'nw', 'se', 'ne', 'sw'];
// var resizeTypes = [
//     {resizeType: 'shrink', resizeDisplayName: 'shrunken'},
//     {resizeType: 'enlarge', resizeDisplayName: 'enlarged'}
// ];
// var dxToShrinkWidth = { n: 0, s: 0, w: 10, e: -10, nw: 10, se: -10, ne: -10, sw: 10 };
// var dyToShrinkHeight = { n: 10, s: -10, w: 0, e: 0, nw: 10, se: -10, ne: 10, sw: -10 };
// var dxToEnlargeWidth = { n: 0, s: 0, w: -10, e: 10, nw: -10, se: 10, ne: 10, sw: -10 };
// var dyToEnlargeHeight = { n: -10, s: 10, w: 0, e: 0, nw: -10, se: 10, ne: -10, sw: 10 };

var testTrace1 = {
    'x': [1, 3, 5, 8, 11, 14, 16, 22, 24, 26, 30, 32],
    'y': [6.5, 7, 8, 9, 10, 11, 11.25, 11.5, 11.75, 12, 10, 12],
    'type': 'scatter',
};

var testTrace2 = {
    'x': [0, 3, 5, 8, 11, 14, 20, 28, 32],
    'y': [0, 1, 2, 3, 10, 1.5, 1.5, 1.5, 1, 1],
    'type': 'scatter',
};

// Helper functions
// function getMoveLineDragElement(index) {
//     index = index || 0;
//     return d3.selectAll('.shapelayer g[data-index="' + index + '"] path').node();
// }

// function getResizeLineOverStartPointElement(index) {
//     index = index || 0;
//     return d3.selectAll('.shapelayer g[data-index="' + index + '"] circle[data-line-point="start-point"]').node();
// }

// function getResizeLineOverEndPointElement(index) {
//     index = index || 0;
//     return d3.selectAll('.shapelayer g[data-index="' + index + '"] circle[data-line-point="end-point"]').node();
// }

function countTracecursorGroups(xAxisRef) {
    var groupClass = '.tracecursor_group';
    var groups = d3.selectAll(groupClass);
    if(xAxisRef !== undefined) {
        return groups.filter(function() { return d3.select(this).attr('xref') === xAxisRef;}).size();
    } else {
        return groups.size();
    }
}

function ifTracecursorGroupExists(groupIndex) {
    var groupId = '#' + 'cursorGroup_' + groupIndex;
    return (d3.selectAll(groupId).size() === 1);
}

function xAxisLabelText(groupId) {
    var node = d3.selectAll(groupId + '> .tracecursor_axis_label text').node();
    if(node) {
        var val = node.textContent;
        return val;
    }
    return null;
}

function yTraceLabelsText(groupId) {
    var content = [];
    d3.selectAll(groupId + '> .tracecursor_flag').selectAll('text.nums').forEach(function(s) {

        var value = s[0].textContent;
        content.push(value);
    });
    return content;
}

function getAddCursorButton(gd) {
    return selectButton(gd._fullLayout._modeBar, 'tracecursorAdd');
}

function getDelCursorButton(gd) {
    return selectButton(gd._fullLayout._modeBar, 'tracecursorDel');
}

function compareValues(val1, val2, mess) {
    if(isNumeric(val1)) {
        expect(val1).toBeWithin(val2, 0.001, mess);
    } else {
        expect(val1).toBe(val2, mess);
    }
}

function compareAsArray(valStr, arr, mess) {

    var vv = valStr.split(',');

    for(var i = 0; i < vv.length; i++) {
        var val1 = vv[i];
        var val2 = arr[i];

        if(isNumeric(val1)) {
            expect(val1).toBeWithin(val2, 0.001, mess);
        } else {
            expect(val1).toBe(val2, mess);
        }
    }

}

// function compareAsDates(val1, val2, ax) {

//     var firstDate = Lib.isDateTime(val1, ax.calendar);

//     var secondDate = Lib.isDateTime(val2, ax.calendar);

//     if(firstDate) {

//         var v1 = ax.d2c(val1, 0, ax.calendar);
//         var v2 = ax.d2c(val2, 0, ax.calendar);

//         expect(v1).toBe(v2);
//     } else {
//         expect(firstDate).toBe(secondDate);
//     }
// }

function testCursorContent(groupInfo) {
    var groupId = '#' + 'cursorGroup_' + groupInfo.groupIndex;
    expect(ifTracecursorGroupExists(groupInfo.groupIndex)).toBeTruthy();

    var val = xAxisLabelText(groupId);


    compareValues(groupInfo.xValue, val, 'X value');

    var lb = yTraceLabelsText(groupId);
    compareAsArray(groupInfo.flagValues, lb, 'Y values');

    testXPosition(groupInfo);
}
exports.testCursorContent = testCursorContent;

function addDeleteCursorTest(testInfo, done) {
    var gd = testInfo.gd;
    var layout = testInfo.layout;
    var data = testInfo.data;
    var groupInfo0 = testInfo.groupInfo0;
    var groupInfo1 = testInfo.groupInfo1;

    var promise = Plotly.plot(gd, data, layout);

    var addCursor = function() {
        promise = promise.then(function() {
            expect(ifTracecursorGroupExists(groupInfo1.groupIndex)).toBeFalsy();
            expect(countTracecursorGroups(groupInfo0.xref)).toEqual(1);

            testCursorContent(groupInfo0);


            getAddCursorButton(gd).click();

            expect(countTracecursorGroups(groupInfo0.xref)).toEqual(2);

            testCursorContent(groupInfo0);
            testCursorContent(groupInfo1);

            getDelCursorButton(gd).click();

            expect(ifTracecursorGroupExists(groupInfo1.groupIndex)).toBeFalsy();
            expect(countTracecursorGroups(groupInfo0.xref)).toEqual(1);

            testCursorContent(groupInfo0);

            done();
        });
    };
    addCursor();
}

function testXPosition(groupInfo) {

    if(groupInfo.xPos === undefined) {
        return;
    }

    var groupIndex = groupInfo.groupIndex;
    var xValue = groupInfo.xPos;

    var xOffset = 100;
    var scale = 3;
    var coords;
    var xCoor = xOffset + xValue * scale;

    var groupId = '#' + 'cursorGroup_' + groupIndex;
    var group = d3.select(groupId);

    if(group.empty()) {
        expect(groupInfo.xPos).toBe('false');
        return;
    }
    group.selectAll('path').each(function() {
        var node = d3.select(this).node();
        var parentClass = d3.select(node.parentElement).attr('class');
        var foundPath = false;

        if('tracecursor_axis_label' === parentClass) {
            coords = getNodeCoords(node, 'n');
            expect(coords.x).toBeWithin(xCoor, 0.01, 'x axis label position');
            foundPath = true;
        } else if('tracecursor_flag' === parentClass) {
            coords = getNodeCoords(node, 'w');
            expect(coords.x).toBeWithin(xCoor, 0.01, 'y axis label position');
            foundPath = true;
        } else if('tracecursor_group' === parentClass) {
            coords = getNodeCoords(node, 's');
            expect(coords.x).toBeWithin(xCoor, 0.01, 'cursor line position');
            foundPath = true;
        }

        expect(foundPath).toBeTruthy('cursor position');
    });
}

describe('Test tracecursors defaults:', function() {
    'use strict';

    function _supply(layoutIn, layoutOut) {
        layoutOut = layoutOut || {};
        layoutOut._has = Plots._hasPlotType.bind(layoutOut);

        Tracecursors.supplyLayoutDefaults(layoutIn, layoutOut);

        return layoutOut.tracecursors;
    }

    it('should skip non-array containers', function() {
        [null, undefined, {}, 'str', 0, false, true].forEach(function(cont) {
            var msg = '- ' + JSON.stringify(cont);
            var layoutIn = { tracecursors: cont };
            var out = _supply(layoutIn);

            expect(layoutIn.tracecursors).toBe(cont, msg);
            expect(out).toEqual([], msg);
        });
    });

    it('should set appropriate value for incorrect x', function() {
        [null, undefined, 'str', false, true].forEach(function(xx) {
            var tracecursors1 =
                {
                    x: xx
                };
            var tracecursors2 = Lib.extendDeep({}, tracecursors1, {xref: 'x2'});
            var tracecursors3 = Lib.extendDeep({}, tracecursors1, {xref: 'x3'});
            var tracecursors4 = Lib.extendDeep({}, tracecursors1, {xref: 'x4'});


            var yAxis = {type: 'linear', range: [0, 10]};

            var fullLayout = {
                xaxis: {type: 'linear', range: [0, 20]},
                yaxis: yAxis,
                xaxis2: {type: 'log', range: [1, 5]},
                yaxis2: yAxis,
                xaxis3: {type: 'date', range: ['2006-06-05', '2006-06-09']},
                yaxis3: yAxis,
                xaxis4: {type: 'category', range: [-0.5, 7.5]},
                yaxis4: yAxis,
                _subplots: {xaxis: ['x', 'x2', 'x3', 'x4'], yaxis: ['y', 'y2', 'y3', 'y4']}
            };

            Axes.setConvert(fullLayout.xaxis);
            Axes.setConvert(fullLayout.yaxis);
            Axes.setConvert(fullLayout.xaxis2);
            Axes.setConvert(fullLayout.yaxis2);
            Axes.setConvert(fullLayout.xaxis3);
            Axes.setConvert(fullLayout.yaxis3);
            Axes.setConvert(fullLayout.xaxis4);
            Axes.setConvert(fullLayout.yaxis4);

            var layoutIn = {
                tracecursors: [tracecursors1, tracecursors2, tracecursors3, tracecursors4]
            };

            _supply(layoutIn, fullLayout);

            var tracecursor1Out = fullLayout.tracecursors[0];
            expect(tracecursor1Out.x).toBeWithin(10, 0.001);

            var tracecursor2Out = fullLayout.tracecursors[1];
            expect(tracecursor2Out.x).toBeWithin(3, 0.001);

            var tracecursor3Out = fullLayout.tracecursors[2];
            expect(tracecursor3Out.x).toBe(1149638400000);

            var tracecursor4Out = fullLayout.tracecursors[3];
            expect(tracecursor4Out.x).toBeWithin(3.5, 0.001);
        });
    });
});

describe('Test tracecursors with', function() {

    it('single trace on single X axis', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var tracecursorOptions = [

            {
                x: 3.5
            }];

        var trace1 = Lib.extendDeep({}, testTrace1);

        var layout = {
            hovermode: false,
            showlegend: true,

            xaxis: {
                title: 'X axis',
            },

            yaxis: {
                title: 'Y axis'
            },
            tracecursors: tracecursorOptions,
        };

        var mock = {
            data: [trace1],
            layout: layout
        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: '3.5',
            flagValues: '7.250174'
        };

        Plotly.plot(gd, mock).then(function() {
            expect(countTracecursorGroups())
                .toEqual(1);

            testCursorContent(groupInfo0);
        })
        .catch(failTest)
        .then(done);
    });
});

describe('Test add/delete tracecursors for:', function() {
    it('single trace on single X axis', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var tracecursorOptions = [

            {
                x: 3.5
            }];

        var trace1 = Lib.extendDeep({}, testTrace1);

        var layout = {
            hovermode: false,
            showlegend: true,

            xaxis: {
                title: 'X axis',
            },

            yaxis: {
                title: 'Y axis'
            },
            tracecursors: tracecursorOptions,
        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: '3.5',
            flagValues: '7.250023'
        };

        var groupInfo1 = {
            groupIndex: 1,
            xValue: '16.5',
            flagValues: '11.27083'
        };

        var testInfo = {
            gd: gd,
            layout: layout,
            data: [trace1],
            groupInfo0: groupInfo0,
            groupInfo1: groupInfo1
        };

        addDeleteCursorTest(testInfo, done);
    });

    it('single trace on single X axis with "vhv" shape', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var tracecursorOptions = [

            {
                x: 3.5
            }];


        var opts = { line: {shape: 'vhv'}};
        var trace1 = Lib.extendDeep({}, testTrace1, opts);

        var layout = {
            hovermode: false,
            showlegend: true,

            xaxis: {
                title: 'X axis',
            },

            yaxis: {
                title: 'Y axis'
            },
            tracecursors: tracecursorOptions,
        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: '3.5',
            flagValues: '7.5'
        };

        var groupInfo1 = {
            groupIndex: 1,
            xValue: '16.5',
            flagValues: '11.375'
        };

        var testInfo = {
            gd: gd,
            layout: layout,
            data: [trace1],
            groupInfo0: groupInfo0,
            groupInfo1: groupInfo1
        };

        addDeleteCursorTest(testInfo, done);
    });

    it('for single trace on "date" X axis', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var trace1 =
            {
                x: ['2013-10-04 22:23:00', '2013-11-04 22:23:00', '2013-12-04 22:23:00'],
                y: [1, 3, 6],

                type: 'scatter',
                yaxis: 'y2',
               // line: {shape: 'vhv'},
            };

        var tracecursors1 = [
            {
                x: '2013-10-05 00:00:00'
            }];

        var layout = {
            hovermode: false,
            showlegend: true,

            xaxis: {
                title: 'X axis',
                type: 'date'
            },

            yaxis: {
                title: 'Y axis'
            },
            tracecursors: tracecursors1,

        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: 'Oct 5, 2013',
            flagValues: '1.004358'
        };

        var groupInfo1 = {
            groupIndex: 1,
            xValue: 'Nov 4, 2013, 10:23',
            flagValues: '2.967742'
        };

        var testInfo = {
            gd: gd,
            layout: layout,
            data: [trace1],
            groupInfo0: groupInfo0,
            groupInfo1: groupInfo1
        };

        addDeleteCursorTest(testInfo, done);
    });

    it('for 4 traces in two rows', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var tracecursorOptions4 = [
            {
                x: 3.5
            }];

        var trace1 = Lib.extendDeep({}, testTrace1);

        var yaxisOpt2 = {yaxis: 'y2'};

        var trace2 = Lib.extendDeep({}, testTrace2, yaxisOpt2);

        var yaxisOpt3 = {yaxis: 'y3'};

        var trace3 = Lib.extendDeep({}, testTrace2, yaxisOpt3);

        var yaxisOpt4 = {yaxis: 'y4'};
        var trace4 = Lib.extendDeep({}, testTrace1, yaxisOpt4);

        var layout = {
            hovermode: false,
            xaxis: {
                title: 'X axis',
                domain: [0.1, 1],
            },

            yaxis: {
                title: 'Y axis',
                domain: [0, 0.45],
            },

            yaxis2: {
                title: 'Y2 axis',
                overlaying: 'y',
                side: 'left',
                position: 0
            },

            yaxis3: {
                domain: [0.55, 1],
                title: 'Y3 axis'
            },

            yaxis4: {
                title: 'Y4 axis',
                overlaying: 'y3',
                side: 'left',
                position: 0
            },

            tracecursors: tracecursorOptions4
        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: '3.5',
            flagValues: '7.249901,1.249901,1.249901,7.249901'
        };

        var groupInfo1 = {
            groupIndex: 1,
            xValue: '16',
            flagValues: '11.25,1.5,1.5,11.25'
        };

        var testInfo = {
            gd: gd,
            layout: layout,
            data: [trace1, trace2, trace3, trace4],
            groupInfo0: groupInfo0,
            groupInfo1: groupInfo1
        };

        addDeleteCursorTest(testInfo, done);

    });

});

describe('Test tracecursors with', function() {
    var gd;
    var tracecursorOptions = [
        {
            x: 2.75
        }];

    var layout = {
        hovermode: false,
        showlegend: true,

        xaxis: {
            title: 'X axis',
        },

        yaxis: {
            title: 'Y axis'
        },
        tracecursors: tracecursorOptions,
    };

    var groupInfo0 = [];

    groupInfo0.vhv = {
        groupIndex: 0,
        xValue: '2.75',
        flagValues: '6.75'
    };
    groupInfo0.hvh = {
        groupIndex: 0,
        xValue: '2.75',
        flagValues: '7'
    };
    groupInfo0.vh = {
        groupIndex: 0,
        xValue: '2.75',
        flagValues: '7'
    };
    groupInfo0.hv = {
        groupIndex: 0,
        xValue: '2.75',
        flagValues: '6.5'
    };

    groupInfo0.linear = {
        groupIndex: 0,
        xValue: '2.75',
        flagValues: '6.9375'
    };

    var testWithShape = function(gd, shape, done) {
        var opts = { line: {shape: shape}};
        var trace1;

        if(shape) {
            trace1 = Lib.extendDeep({}, testTrace1, opts);
        } else {
            trace1 = Lib.extendDeep({}, testTrace1);
        }

        if(!shape) {
            // 'linear' is default shape
            shape = 'linear';
        }

        var mock = {
            data: [trace1],
            layout: layout
        };

        Plotly.plot(gd, mock).then(function() {
            expect(countTracecursorGroups())
                .toEqual(1);

            testCursorContent(groupInfo0[shape]);
                // done();

        }).catch(failTest)
        .then(done);
    };


    it('shape = vhv', function(done) {
        var shape = 'vhv';
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

    it('shape = hvh', function(done) {
        var shape = 'hvh';
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

    it('shape = hv', function(done) {
        var shape = 'hv';
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

    it('shape = vh', function(done) {
        var shape = 'vh';
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

    it('shape = linear', function(done) {
        var shape = 'linear';
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

    it('shape = default', function(done) {
        var shape = null;
        destroyGraphDiv();
        gd = createGraphDiv();

        testWithShape(gd, shape, done);
    });

});

describe('Test tracecursors move', function() {

    var gd;

    var defaultTracecursorOptions = [
        {
            x: 0
        }];

    // 0, 25, 50, 75, 100, 0
    var defaultInfos = [];

    defaultInfos[0] = {
        groupIndex: 0,
        xValue: '0',
        flagValues: '0',
        xPos: 0
    };

    defaultInfos[25] = {
        groupIndex: 0,
        xValue: '25',
        flagValues: '25',
        xPos: 25
    };

    defaultInfos[50] = {
        groupIndex: 0,
        xValue: '50',
        flagValues: '50',
        xPos: 50
    };

    defaultInfos[75] = {
        groupIndex: 0,
        xValue: '75',
        flagValues: '75',
        xPos: 75
    };

    defaultInfos[100] = {
        groupIndex: 0,
        xValue: '100',
        flagValues: '100',
        xPos: 100
    };

    function makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, shape) {
        gd = createGraphDiv();

        var trace = {
            x: xPoints,
            y: yPoints,
            line: {shape: shape}
        };

        // we've already tested autorange with relayout, so fix the geometry
        // completely so we know exactly what we're dealing with
        // plot area is 300x300, and covers data range 100x100
        return Plotly.plot(gd,
            [trace],
            {
                xaxis: {range: xRange},
                yaxis: {range: yRange},
                width: 500,
                height: 500,
                margin: {l: 100, r: 100, t: 100, b: 100, pad: 0},
                tracecursors: tracecursorOptions
            }
        );
    }

    function dragCursor(node, dx, dy) {
        return drag(node, dx, dy).then(function() {
            return Plots.previousPromises(gd);
        });
    }

    function getCursorLine() { return gd.querySelector('.tracecursor_group > path'); }

    function checkDragging(findDragger, infos) {
        // 0, 25, 50, 75, 100, 0

        var dxx = [75, 75, 75, 75, -300];

        testCursorContent(infos[0]);
        // move to the right a little bit
        return dragCursor(findDragger(), dxx[0], -30)
        .then(function() {
            testCursorContent(infos[25]);

            // now move to the right close to the edge
            return dragCursor(findDragger(), dxx[1], 0);
        })
        .then(function() {
            testCursorContent(infos[50]);

             // now move to the right outside of the edge
            return dragCursor(findDragger(), dxx[2], 0);
        })
        .then(function() {
            testCursorContent(infos[75]);

            // finally move it back to the initial position
            return dragCursor(findDragger(), dxx[3], 30);
        })
        .then(function() {
            testCursorContent(infos[100]);

            // finally move it back to the initial position
            return dragCursor(findDragger(), dxx[4], 30);
        })
        .then(function() {
            testCursorContent(infos[0]);
        });
    }

    it('with "linear" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 100];
        var yPoints = [0, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var linearInfos = Lib.extendDeep([], defaultInfos);

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear').then(function() {
            return checkDragging(getCursorLine, linearInfos);
        }).catch(failTest)
        .then(done);
    });


    it('with "vhv" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var vhvInfos = Lib.extendDeep([], defaultInfos);

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vhv').then(function() {
            return checkDragging(getCursorLine, vhvInfos);
        }).catch(failTest)
        .then(done);
    });

    it('with "hvh" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var hvhInfos = Lib.extendDeep([], defaultInfos);
        hvhInfos[25].flagValues = '50';
        hvhInfos[75].flagValues = '100';

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hvh').then(function() {
            return checkDragging(getCursorLine, hvhInfos);
        }).catch(failTest)
        .then(done);
    });

    it('with "vh" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var vhInfos = Lib.extendDeep([], defaultInfos);
        vhInfos[25].flagValues = '50';
        vhInfos[75].flagValues = '100';

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);


        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vh').then(function() {
            return checkDragging(getCursorLine, vhInfos);
        }).catch(failTest)
        .then(done);
    });

    it('with "hv" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var hvInfos = Lib.extendDeep([], defaultInfos);
        hvInfos[25].flagValues = '0';
        hvInfos[75].flagValues = '50';

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hv').then(function() {
            return checkDragging(getCursorLine, hvInfos);
        }).catch(failTest)
        .then(done);
    });

    it('with date X axis', function(done) {
        destroyGraphDiv();

        var xPoints = ['2017-10-04 00:00:00', '2017-10-04 12:00:00', '2017-10-05 00:00:00'];
        var yPoints = [0, 50, 100];
        var xRange = ['2017-10-04 00:00:00', '2017-10-05 00:00:00'];
        var yRange = [0, 100];

        var tracecursorOptions = [
            {
                x: '2017-10-04 00:00:00'
            }];

        var dateInfos = Lib.extendDeep({}, defaultInfos);

        dateInfos[0].xValue = 'Oct 4, 2017';
        dateInfos[25].xValue = 'Oct 4, 2017, 06:00';
        dateInfos[50].xValue = 'Oct 4, 2017, 12:00';
        dateInfos[75].xValue = 'Oct 4, 2017, 18:00';
        dateInfos[100].xValue = 'Oct 5, 2017';

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear')
        .then(function() {
            return checkDragging(getCursorLine, dateInfos);
        })
        .catch(failTest)
        .then(done);
    });

    it('with log X axis', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 2500, 5000, 7500, 10000];
        var yPoints = [];
        yPoints[0] = 0;

        for(var i = 1; i < xPoints.length; i++) {
            yPoints.push(Math.log10(xPoints[i]));
        }

        var xRange = [0, 10000];
        var yRange = [0, 4];

        var tracecursorOptions = [
            {
                x: 0
            }];

        var logInfos = Lib.extendDeep({}, defaultInfos);

        logInfos[0].xValue = '0';
        logInfos[25].xValue = '2500';
        logInfos[50].xValue = '5000';
        logInfos[75].xValue = '7500';
        logInfos[100].xValue = '10k';

        logInfos[0].flagValues = '0';
        logInfos[25].flagValues = '' + Math.log10(2500);
        logInfos[50].flagValues = '' + Math.log10(5000);
        logInfos[75].flagValues = '' + Math.log10(7500);
        logInfos[100].flagValues = '4';

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear')
        .then(function() {
            return checkDragging(getCursorLine, logInfos);
        })
        .catch(failTest)
        .then(done);
    });


    it(' test position', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 100];
        var yPoints = [0, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        tracecursorOptions[0].x = 20;

        var info = {
            groupIndex: 0,
            xValue: '20',
            flagValues: '0',
            xPos: 20
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear')
        .then(function() {
            testXPosition(info);
        })
        .catch(failTest)
        .then(done);
    });
});

describe('Test tracecursors subplots', function() {

    it('for 2 traces in two subpolots', function(done) {
        destroyGraphDiv();
        var gd = createGraphDiv();

        var tracecursorOptions1 = [
            {
                x: 3.5
            },
            {
                x: 4.5,
                xref: 'x2'
            }
        ];

        var trace1 = Lib.extendDeep({}, testTrace1);

        var yaxisOpt2 = {yaxis: 'y2'};

        var trace2 = Lib.extendDeep({}, testTrace2, yaxisOpt2);

        var yaxisOpt3 = {xaxis: 'x2', yaxis: 'y3'};

        var trace3 = Lib.extendDeep({}, testTrace2, yaxisOpt3);

        var yaxisOpt4 = {xaxis: 'x2', yaxis: 'y4'};
        var trace4 = Lib.extendDeep({}, testTrace1, yaxisOpt4);

        var layout = {
            hovermode: false,
            xaxis: {
                title: 'X axis 1',
                domain: [0.1, 1],
            },
            xaxis2: {
                title: 'X axis 2',
                domain: [0.1, 1],
                anchor: 'y3'
            },

            yaxis: {
                title: 'Y axis',
                domain: [0, 0.4],
            },

            yaxis2: {
                title: 'Y2 axis',
                overlaying: 'y',
                side: 'left',
                anchor: 'free',
            },

            yaxis3: {
                domain: [0.6, 1],
                title: 'Y3 axis',
                anchor: 'x2'
            },

            yaxis4: {
                title: 'Y4 axis',
                overlaying: 'y3',
                anchor: 'free',
                side: 'left',
            },

            tracecursors: tracecursorOptions1
        };

        var groupInfo0 = {
            groupIndex: 0,
            xValue: '3.5',
            flagValues: '7.25,1.25',
            xref: 'x'
        };

        var groupInfo1 = {
            groupIndex: 1,
            xValue: '4.5',
            flagValues: '1.75,7.75',
            xref: 'x2'
        };

        Plotly.plot(gd, [trace1, trace2, trace3, trace4], layout).then(function() {
            expect(countTracecursorGroups())
                .toEqual(2);
            expect(countTracecursorGroups('x'))
                .toEqual(1);
            expect(countTracecursorGroups('x2'))
                .toEqual(1);

            testCursorContent(groupInfo0);
            testCursorContent(groupInfo1);
        })
        .catch(failTest)
        .then(done);
    });

});

describe('Test tracecursors zoom with', function() {
    var gd;

    var defaultTracecursorOptions = [
        {
            x: 20
        }];

    var xOffset = 100;
    var scale = 3;
    var zoomShift = 10;

        // 0, 25, 50, 75, 100, 0
    var defaultInfos = [];

    defaultInfos[0] = {
        groupIndex: 0,
        xValue: '0',
        flagValues: '0',
        xPos: 0
    };

    defaultInfos[25] = {
        groupIndex: 0,
        xValue: '25',
        flagValues: '25',
        xPos: 25
    };

    defaultInfos[50] = {
        groupIndex: 0,
        xValue: '50',
        flagValues: '50',
        xPos: 50
    };

    defaultInfos[75] = {
        groupIndex: 0,
        xValue: '75',
        flagValues: '75',
        xPos: 75
    };

    defaultInfos[100] = {
        groupIndex: 0,
        xValue: '100',
        flagValues: '100',
        xPos: 100
    };

    function makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, shape) {

        gd = createGraphDiv();

        var trace = {
            x: xPoints,
            y: yPoints,
            line: {shape: shape}
        };

            // we've already tested autorange with relayout, so fix the geometry
            // completely so we know exactly what we're dealing with
            // plot area is 300x300, and covers data range 100x100
        return Plotly.plot(gd,
                [trace],
            {
                xaxis: {range: xRange},
                yaxis: {range: yRange},
                width: 500,
                height: 500,
                margin: {l: 100, r: 100, t: 100, b: 100, pad: 0},
                tracecursors: tracecursorOptions,
                dragmode: 'zoom'
            }
            );
    }

    function doZoom(groupInfo, shift) {
        var delta = 0;
        if(shift !== undefined) {
            delta = shift;
        }
        var xValue = delta + groupInfo.xValue;
        var fromX = xOffset + (xValue - zoomShift) * scale;
        var fromY = 200;
        var toX = fromX + 2 * zoomShift * scale;
        var toY = 200;

        return new Promise(function(resolve) {
            mouseEvent('mousemove', fromX, fromY);
            mouseEvent('mousedown', fromX, fromY);
            mouseEvent('mousemove', toX, toY);

            setTimeout(function() {
                mouseEvent('mouseup', toX, toY);
                resolve();
            }, DBLCLICKDELAY / 4);
        });
    }

    function doDataZoom(groupInfo, shift) {
        var delta = 0;
        if(shift !== undefined) {
            delta = shift;
        }
        var xValue = delta + 25;
        var fromX = xOffset + (xValue - zoomShift) * scale;
        var fromY = 200;
        var toX = fromX + 2 * zoomShift * scale;
        var toY = 200;

        return new Promise(function(resolve) {
            mouseEvent('mousemove', fromX, fromY);
            mouseEvent('mousedown', fromX, fromY);
            mouseEvent('mousemove', toX, toY);

            setTimeout(function() {
                mouseEvent('mouseup', toX, toY);
                resolve();
            }, DBLCLICKDELAY / 4);
        });
    }

    it('with "linear" as line shape', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 100];
        var yPoints = [0, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '20',
            xPos: 50
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear').then(function() {
            doZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "linear" as line shape and zoom without cursor', function(done) {
        destroyGraphDiv();

        var xPoints = [0, 100];
        var yPoints = [0, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];


        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '20',
            xPos: -150
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear').then(function() {
            doZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });

    it('with "vhv" as line shape', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '25',
            xPos: 50
        };


        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vhv').then(function() {
            doZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "vhv" as line shape and without cursor', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);

        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '25',
            xPos: -150
        };


        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vhv').then(function() {
            doZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });

    it('with "hvh" as line shape', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '0',
            xPos: 50
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hvh').then(function() {
            doZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "hvh" as line shape and without cursor', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '0',
            xPos: -150
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hvh').then(function() {
            doZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });

    it('with "hv" as line shape', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '0',
            xPos: 50
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hv').then(function() {
            doZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "hv" as line shape and without cursor', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '0',
            xPos: -150
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hv').then(function() {
            doZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });

    it('with "vh" as line shape', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '50',
            xPos: 50
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vh').then(function() {
            doZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "vh" as line shape and without cursor', function(done) {

        destroyGraphDiv();

        var xPoints = [0, 50, 100];
        var yPoints = [0, 50, 100];
        var xRange = [0, 100];
        var yRange = [0, 100];

        var tracecursorOptions = Lib.extendDeep([], defaultTracecursorOptions);
        var groupInfo = {
            groupIndex: 0,
            xValue: tracecursorOptions[0].x,
            flagValues: '50',
            xPos: -150
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'vh').then(function() {
            doZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });

    it('with "date" as X Axis', function(done) {

        destroyGraphDiv();

        var xPoints = ['2017-10-04 00:00:00', '2017-10-04 12:00:00', '2017-10-05 00:00:00'];
        var yPoints = [0, 50, 100];
        var xRange = ['2017-10-04 00:00:00', '2017-10-05 00:00:00'];
        var yRange = [0, 100];

        var tracecursorOptions = [
            {
                x: '2017-10-04 06:00:00'
            }];


        var groupInfo = {
            groupIndex: 0,
            xValue: 'Oct 4, 2017, 06:00',
            flagValues: '25',
            xPos: 50
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'linear').then(function() {
            doDataZoom(groupInfo).then(function() {
                testCursorContent(groupInfo);
                done();
            });
        });
    });

    it('with "date" as X Axis and without cursor', function(done) {

        destroyGraphDiv();

        var xPoints = ['2017-10-04 00:00:00', '2017-10-04 12:00:00', '2017-10-05 00:00:00'];
        var yPoints = [0, 50, 100];
        var xRange = ['2017-10-04 00:00:00', '2017-10-05 00:00:00'];
        var yRange = [0, 100];

        var tracecursorOptions = [
            {
                x: '2017-10-04 00:00:00'
            }];


        var groupInfo = {
            groupIndex: 0,
            xValue: 'Oct 4, 2017, 06:00',
            flagValues: '25',
            xPos: -275
        };

        makePlot(tracecursorOptions, xPoints, yPoints, xRange, yRange, 'hv').then(function() {
            doDataZoom(groupInfo, 40).then(function() {
                testXPosition(groupInfo);
                done();
            });
        });
    });


});
