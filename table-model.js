TableModel = (function($) {
    var TableModel = function($table, options) {
        this.getTable = function() {
            return $table;    
        };
        this.options = $.extend({}, defaultOptions, options);

        this.cellListeners = [];
        this.rowListeners = [];
        this.columnListeners = [];

        this.options.wireTableEvents.call(this);
        $table.data("table-model", this);
    };

    var addListener = function(type, handler) {
        this[type + "Listeners"].push(handler);
    };

    var callListeners = function(type, arguments) {
        // console.log("calling " + type + " listeners");
        var listeners = this[type + "Listeners"];
        for (var index in listeners) {
            listeners[index].apply(null, arguments);
        }
    };

    var getRows = function($table) {
        if ($table.has("thead, tbody")) {
            var trs = $table.children("thead").children("tr");
            trs = trs.add($table.children("tbody").children("tr"));
            trs = trs.add($table.children("tfoot").children("tr"));
            return trs;
        } else {
            return $table.children("tr");
        }    
    };

    var staticWireTableEvents = function() {
        var $table = this.getTable();
        var tableModel = this;

        console.log($table);

        var rows = getRows($table);
        rows.each(function(rowIndex) {
            var $row = $(this);
            $row.addClass("row-" + rowIndex);
            $row.children("td, th").each(function(columnIndex) {
                var $cell = $(this);
                $cell.addClass("column-" + columnIndex);
                $cell.data("row", rowIndex);
                $cell.data("column", columnIndex);
            });
        });

        $table.on("change", "td input, td textarea", function() {
            var $cell = $(this);
            if (!$cell.is("td, th")) {
                $cell = $cell.closest("td, th");
            }
            var row = $cell.data("row");
            var column = $cell.data("column");
            onCellValueChange.call(tableModel, row, column);
        });
    };

    var staticFindCell = function(row, column) {
        return this.getTable().find(".row-" + row).find(".column-" + column);
    };
    
    var defaultReadCellValue = function(cell) {
        if (cell.has("input").length) {
            return cell.children("input").val();
        } else if (cell.has("textarea").length) {
            return cell.children("textarea").text();
        } else {
            return cell.text();
        }
    };   

    var defaultSetCellValue = function(cell, value) {
        if (cell.has("input").length) {
            cell.children("input").val(value);
        } else if (cell.has("textarea").length) {
            cell.children("textarea").text(value);
        } else {
            cell.text(value);
        }        
    };

    var onCellValueChange = function(row, column) {
        callListeners.call(this, "cell", [row, column]);
        callListeners.call(this, "row", [row]);
        callListeners.call(this, "column", [column]);
    };

    var bindExpression = function(tableModel, cell, row, column, expression) {
        var selection = expression.sourceSelection
        var applyHandler = function() {
            var value = evaluate(tableModel, expression);
            tableModel.options.setCellValue.call(tableModel, cell, value);
            onCellValueChange.call(tableModel, row, column);
        };
        tableModel.onCellChange(function(row, column) {
            // console.log("onCellChange: " + row + "," + column);
            if (expression.sourceSelection.includes(row, column)) {
                // console.log("we go here");
                applyHandler();
            }
        }); 
        applyHandler();       
    };

    var defaultOptions = {
        findCell : staticFindCell,

        wireTableEvents : staticWireTableEvents,

        readCellValue : defaultReadCellValue,

        setCellValue : defaultSetCellValue
    };

    TableModel.prototype = {


        get : function(row, column) {
            var cell = this.options.findCell.call(this, row, column);
            var value = this.options.readCellValue.call(this, cell);
            return value;
        },

        set : function(row, column, value) {
            var cell = this.options.findCell.call(this, row, column);

            if (isExpression(value)) {
                bindExpression(this, cell, row, column, value);
                return true;
            } else {
                var originalValue = this.options.readCellValue.call(this, cell);
                if (value !== originalValue) {
                    this.options.setCellValue.call(this, cell, value);
                    onCellValueChange.call(this, row, column);
                    return true;
                } else {
                    return false;
                }
            }
        },

        listen : function(expression, handler) {
            var tableModel = this;
            this.onCellChange(function(row, column) {
                if (expression.sourceSelection.includes(row, column)) {
                    var value = evaluate(tableModel, expression);
                    handler(value);
                }
            });            
        },

        onCellChange : function(listener) {
            addListener.call(this, "cell", listener);
        },

        onColumnChange : function(listener) {
            addListener.call(this, "column", listener);
        },

        onRowChange : function(listener) {
            addListener.call(this, "row", listener);
        }
    };

    /** Selections **/
    var isSelection = function(arg) {
        return (arg.all && arg.includes);
    };

    var asSelection = function(arg) {
        if (isSelection(arg)) {
            return arg;
        } else if ($.isArray(arg)) {
            var array = arg;

            if ((arg.length == 2) && !$.isArray(arg[0])) {
                array = [ arg ];
            }

            var selection = {
                includes : function(row, column) {
                    for (var i in array) {
                        if (array[i][0] == row && array[i][1] == column) {
                            return true;
                        }
                    }
                    return false;
                },
                all : function() {
                    return array;
                },
                empty : function() {
                    return !array.length;
                }
            };
            return selection;
        } else {
            console.log("error");
        }
    };

    TableModel.select = {
        empty : function() {
            var selection = {
                includes : function() {
                    return false;
                },
                all : function() {
                    return [];
                },
                empty : function() {
                    return true;
                }
            }
        },

        cell : function(row, column) {
            return asSelection([row, column]);
        },

        range : function(top, left, bottom, right) {
            var selection = {
                includes : function(row, column) {
                    result = (
                        row >= top &&
                        row <= bottom &&
                        column >= left &&
                        column <= right
                    );
                    return result;
                },
                all : function() {
                    var indices = [];
                    for (i = top; i <= bottom; i++) {
                        for (j = left; j <= right; j++) {
                            indices.push([i, j]);
                        }
                    }
                    return indices;            
                },
                empty : function() {
                    return !((bottom - top) >= 0 && (right - left) >= 0);
                }       
            };
            return selection;
        },

        combine : function() {
            var selections = [];

            if (arguments.length == 1 && $.isArray(arguments[0])) {
                var args = arguments[0];
            } else {
                var args = arguments;
            }

            $.each(args, function(index, argument) {
                var selection = asSelection(argument);
                if (!selection.empty()) {
                    selections.push(selection);
                }
            });

            var selection = {
                includes : function(row, column) {
                    for (var index in selections) {
                        if (selections[index].includes(row, column)) {
                            return true;
                        }
                    }
                    return false;
                },
                all : function() {
                    var indices = [];
                    for (var index in selections) {
                        indices = indices.concat(selections[index].all())
                    }
                    return indices;
                },
                empty : function() {
                    return !selections.length;
                }
            }
            return selection;
        }
    };

    var isExpression = function(arg) {
        return !!arg.evaluate;
    }

    var evaluate = function(tableModel, expression) {
        var values = [];
        $.each (expression.args, function(index, arg) {
            var value;
            if (isExpression(arg)) {
                value = evaluate(tableModel, arg);
            } else if (isSelection(arg)) {
                value = [];
                $.each(arg.all(), function(i, cellIndex) {
                    value.push(tableModel.get(cellIndex[0], cellIndex[1]));
                });
            } else {
                value = arg;
            }

            if (expression.flatten && $.isArray(value)) {
                values = values.concat(value);
            } else {
                values.push(value);
            }
        });
        return expression.evaluate(values);
    }

    var findExpressionSourceSelection = function(expression) {
        var selections = [];
        $.each(expression.args, function(index, arg) {
            if (isSelection(arg)) {
                // console.log(arg.all());
                selections.push(arg);
            } else if (isExpression(arg)) {
                var selection = arg.sourceSelection;
                selections.push(selection);
            }
        });
        if (selections.length == 0) return TableModel.select.empty();
        if (selections.length == 1) return selections[0];
        var combination = TableModel.select.combine(selections);
        return combination;
    }

    var Expression = function(args, evaluateFunction, options) {
        this.args = args;
        this.sourceSelection = findExpressionSourceSelection(this);
        this.evaluate = evaluateFunction;
        $.extend(this, options);
    };

    Expression.prototype = {
        flatten: false
    };

    var asNumber = function(value) {
        var number = parseFloat(value);
        if (number == value) {
            return number;       
        } else {
            return 0;
        }
    };

    TableModel.expression = {
        Base : Expression,

        sum : function() {
            return new Expression(arguments, function(values) {
                var result = 0;
                $.each(values, function(index, value) {
                    result += asNumber(value);
                });
                return result;
            }, {
                flatten: true
            });
        },

        product : function() {
            return new Expression(arguments, function(values) {
                var result = 1;
                $.each(values, function(index, value) {
                    result *= asNumber(value);
                });
                return result;
            }, {
                flatten: true
            });
        },        

        countIf : function(selection, value) {
            return new Expression(arguments, function(values) {
                var count = 0;
                var haystack = values[0];
                var needle = values[1];
                $.each(haystack, function(index, item) {
                    if (needle == item) {
                        count++;
                    }
                });
                return count;
            });
        }
    }
    return TableModel;
})(jQuery);