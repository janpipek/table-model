/**
 * Copyright (C) 2013-4 Jan Pipek (jan.pipek@gmail.com)
 *
 * See https://github.com/janpipek/table-model
 *
 * MIT license (see LICENSE.txt)
 */
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

        if (this.options.cachingEnabled) {
            this.cache = [];
        }

        $table.data("table-model", this);
    };

    var addListener = function(type, handler) {
        this[type + "Listeners"].push(handler);
    };

    var callListeners = function(type, arguments) {
        var listeners = this[type + "Listeners"];
        for (var index in listeners) {
            listeners[index].apply(null, arguments);
        }
    };

    /** 
      * Get all rows (including those in thead, tbody, tfoot).
      */ 
    var getRows = function($table) {
        if ($table.has("thead, tbody")) {
            var trs = $table.children("thead:not(.tableFloatingHeader)").children("tr");
            trs = trs.add($table.children("tbody").children("tr"));
            trs = trs.add($table.children("tfoot").children("tr"));
            return trs;
        } else {
            return $table.children("tr");
        }
    };

    /**
      * Label cells with 0-based row & column indexes.
      *
      * @param bool omitClass - unless true, add row-N & column-N
      *     class where applicable.
      * @param bool omitData - unless true, add row & column
      *     jQuery data.
      *
      * Note that TableModel needs the classes for getting cell
      * values.
      */
    var labelCells = function($table, omitClass, omitData) {
        // Handling of indexes blocked by col-/rowspan
        rowSpanBlocked = [];
        var block = function(row, column) {
            var coord = "" + row + "-" + column;
            /* if (rowSpanBlocked.indexOf(coord) >= 0) {
                throw "colspan & rowspan covering the same cell";
            }*/
            rowSpanBlocked.push(coord);
        }

        getRows($table).each(function(rowIndex) {
            var $row = $(this);
            if (!omitClass) $row.addClass("row-" + rowIndex);
            if (!omitData) $row.data("row", rowIndex);
            
            var columnIndex = 0;
            $row.children("td, th").each(function() {
                // Find coords not conflicting with col/rowspan
                while(true) {
                    var coord = "" + rowIndex + "-" + columnIndex;
                    var index = rowSpanBlocked.indexOf(coord);
                    if (index >= 0) {
                        // rowSpanBlocked.splice(index, 1);
                        columnIndex++;
                    } else {
                        break;
                    }
                }

                var $cell = $(this);
                if (!omitClass) {
                    $cell.addClass("column-" + columnIndex + " row-" + rowIndex);
                }
                if (!omitData) {
                    $cell.data("row", rowIndex);
                    $cell.data("column", columnIndex);
                }
                var colSpan = parseInt($cell.attr("colspan")) || 1;
                var rowSpan = parseInt($cell.attr("rowspan")) || 1;
                if (rowSpan > 1) {
                    for (var i = 1; i < rowSpan; i++) {
                        block(rowIndex+i, columnIndex);
                    }
                }
                columnIndex += colSpan;
            });
        })
    };

    var staticWireTableEvents = function() {
        var $table = this.getTable();
        var tableModel = this;

        labelCells($table);

        var eventToListen = this.options.recalculateOnType ? "input" : "change";
        $table.on(eventToListen, "td input, td textarea", function() {
            var $input = $(this);
            var $cell = $input.closest("td, th");
            var row = $cell.data("row");
            var column = $cell.data("column");

            var newValue = $input.val();
            newValue = tableModel.options.valueParser(newValue, $cell);
            $cell.data("value", newValue);

            onCellValueChange.call(tableModel, row, column, newValue);
        });
    };

    var staticFindCell = function(row, column) {
        return this.getTable().find(".row-" + row).find(".column-" + column);
    };

    var defaultReadCellValue = function(cell) {
        if (cell.data("value") !== undefined) {
            return cell.data("value");
        }
        if (cell.has("input").length) {
            return cell.children("input").val();
        } else if (cell.has("textarea").length) {
            return cell.children("textarea").text();
        } else {
            return cell.text();
        }
    };

    var defaultSetCellValue = function(cell, value) {
        cell.data("value", value);

        // Use precision if set
        var precision = undefined;
        if (this.options.precision !== undefined) {
            var precision = this.options.precision;
        }
        if (cell.data("precision") !== undefined) {
            var precision = cell.data("precision")
        }
        if (precision !== undefined) {
            value = value.toFixed(precision);
        }

        if (cell.has("input").length) {
            cell.children("input").val(value);
        } else if (cell.has("textarea").length) {
            cell.children("textarea").text(value);
        } else {
            cell.text(value);
        }
    };

    var onCellValueChange = function(row, column, value) {
        if (this.cache) {
            if (!this.cache[row]) {
                this.cache[row] = [];
            }
            this.cache[row][column] = value;
        }
        callListeners.call(this, "cell", [row, column]);
        callListeners.call(this, "row", [row]);
        callListeners.call(this, "column", [column]);
    };

    var bindExpression = function(tableModel, cell, row, column, expression) {
        var selection = expression.sourceSelection
        var applyHandler = function() {
            var originalValue = tableModel.get(row, column);
            var newValue = evaluate(tableModel, expression);
            if (originalValue !== newValue) {
                tableModel.options.setCellValue.call(tableModel, cell, newValue);
                onCellValueChange.call(tableModel, row, column, newValue);
            }
        };
        tableModel.onCellChange(function(row, column) {
            if (expression.sourceSelection.includes(row, column)) {
                applyHandler();
            }
        });
        applyHandler();
    };

    TableModel.prototype = {
        /**
         * Returns the current value of the cell.
         *
         * It does not return underlying expression, just the value.
         * Returns undefined if cell does not exist.
         */
        get: function(row, column) {
            // Try to read from cache
            if (this.cache) {
                if (this.cache[row] && this.cache[row][column] !== undefined) {
                    return this.cache[row][column];
                }
            }
            var cell = this.getCell.call(this, row, column);
            if (!cell ) {
                return undefined;
            }
            var value = this.options.readCellValue.call(this, cell);
            value = this.options.valueParser(value);
            // Store value in cache (if viable)
            if (this.cache) {
                if (!this.cache[row]) {
                    this.cache[row] = [];
                }
                this.cache[row][column] = value;
            }
            return value;
        },

        /**
         * Return the cell indexed by row and column.
         */
        getCell: function(row, column) {
            return this.options.findCell.call(this, row, column);
        },

        /**
         * Assign a value or a dynamic expression to the cell.
         */
        set: function(row, column, value) {
            var cell = this.options.findCell.call(this, row, column);

            if (isExpression(value)) {
                bindExpression(this, cell, row, column, value);
                // TODO: Before returning true, examine if the value
                //   really changed.
                return true;
            } else {
                var originalValue = this.options.readCellValue.call(this, cell);
                if (value !== originalValue) {
                    this.options.setCellValue.call(this, cell, value);
                    onCellValueChange.call(this, row, column, value);
                    return true;
                } else {
                    return false;
                }
            }
        },

        /**
         * Adds a listener that calls handler whenever expression
         * value changes.
         *
         * @param expression Expression based on cell values
         *     (accepts expressions as complicated as cells themselves)
         * @param handler Function to be called. It should accept new value
         *     of the expression as parameter.
         */
        listen: function(expression, handler) {
            var tableModel = this;
            this.onCellChange(function(row, column) {
                if (expression.sourceSelection.includes(row, column)) {
                    var value = evaluate(tableModel, expression);
                    handler(value);
                }
            });
        },

        /** 
         * Register handler, that gets called whenever cell value changes.
         *
         * The handler receives two parameters: row and column
         */
        onCellChange: function(listener) {
            addListener.call(this, "cell", listener);
        },

        /** 
         * Register handler, that gets called whenever a cell in a column changes.
         *
         * The handler receives one parameter: column
         */
        onColumnChange: function(listener) {
            addListener.call(this, "column", listener);
        },

        /** 
         * Register handler, that gets called whenever a cell in a row changes.
         *
         * The handler receives one paramater: row
         */
        onRowChange: function(listener) {
            addListener.call(this, "row", listener);
        }
    };

    // Parser functions for cells
    TableModel.valueParsers = {
        default : function(value, $cell) {
            return value;
        },

        commaAsDot : function(value, $cell) {
            if (value) {
                return value.replace(",", ".");
            } else {
                return value;
            }
        },

        /**
         * Chain two parsers together.
         *
         * @param outerParser A function that will be called on the intermediate step.
         * @param innerParser A function that will be called first.
         * @return A combined parser.
         */
        chain : function(outerParser, innerParser) {
            var newParser = function(value, $cell) {
                return outerParser(innerParser(value, $cell));
            };
            return newParser;
        }
    };

    var defaultOptions = {
        findCell: staticFindCell,

        wireTableEvents: staticWireTableEvents,

        readCellValue: defaultReadCellValue,

        valueParser: TableModel.valueParsers.default,

        setCellValue: defaultSetCellValue,

        recalculateOnType: false,

        cachingEnabled: true
    };

    /**
     * Check if argument behaves (duck-typing) like a selection.
     */
    var isSelection = function(arg) {
        if (arg === undefined) {
            throw "Invalid selection-like object.";
        }
        return (arg.all && arg.includes);
    };

    /**
     * Interpret argument as a selection.
     *
     * Proper selections are left as-is.
     * Arrays of pairs and a single pair are converted
     *   to a collection of cells.
     * Otherwise exception is thrown.
     */
    var asSelection = function(arg) {
        if (isSelection(arg)) {
            return arg;
        } else if ($.isArray(arg)) {
            var array = arg;

            if ((arg.length == 2) && !$.isArray(arg[0])) {
                array = [arg];
            }

            var selection = {
                includes: function(row, column) {
                    for (var i in array) {
                        if (array[i][0] == row && array[i][1] == column) {
                            return true;
                        }
                    }
                    return false;
                },
                all: function() {
                    return array;
                },
                empty: function() {
                    return !array.length;
                }
            };
            return selection;
        } else {
            throw "asSelection: argument cannot be interpreted as selection.";
        }
    };

    /**
     * Namespace of all cell selections.
     *
     * Selections are collections of cells that:
     * - know if they are empty (method empty)
     * - know if they include a specific cell (method includes)
     * - know all their cells (method all)
     *
     * Any two (or more collections) can be combined
     *     using Table.model.select.combine(selections...)
     *
     */
    TableModel.select = {
        /**
         * Empty selection.
         */
        empty: function() {
            var selection = {
                includes: function() {
                    return false;
                },
                all: function() {
                    return [];
                },
                empty: function() {
                    return true;
                }
            }
        },

        /**
         * Selection consisting of a single cell.
         */
        cell: function(row, column) {
            return asSelection([row, column]);
        },

        /**
         * Selection consisting of a rectangular area.
         *
         * The coordinates are inclusive,
         *     e.g. right == left if a single column is selected.
         */
        range: function(top, left, bottom, right) {
            var selection = {
                includes: function(row, column) {
                    result = (
                    row >= top && row <= bottom && column >= left && column <= right);
                    return result;
                },
                all: function() {
                    var indices = [];
                    for (i = top; i <= bottom; i++) {
                        for (j = left; j <= right; j++) {
                            indices.push([i, j]);
                        }
                    }
                    return indices;
                },
                empty: function() {
                    return !((bottom - top) >= 0 && (right - left) >= 0);
                }
            };
            return selection;
        },

        /**
         * A combination of selections.
         *
         * Any number of selections or cell [row,column] pairs
         *     can be supplied.
         */
        combine: function() {
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
                includes: function(row, column) {
                    for (var index in selections) {
                        if (selections[index].includes(row, column)) {
                            return true;
                        }
                    }
                    return false;
                },
                all: function() {
                    var indices = [];
                    for (var index in selections) {
                        indices = indices.concat(selections[index].all())
                    }
                    return indices;
                },
                empty: function() {
                    return !selections.length;
                }
            }
            return selection;
        }
    };

    /** 
     * Check (duck-typing) if argument can be evaluated as expression.
     */
    var isExpression = function(arg) {
        return !!arg.evaluate;
    }

    /**
     * Evaluate an expression.
     *
     * @param tableModel Model has to be supplied because expressions
     *     don't store information about able in themselves.
     * @param expression Evaluate an expression starting with its
     *     arguments that can be expressions as well.
     *
     * It also sets expression.tableModel, so that tableModel
     * can be use in the expression handler.
     */
    var evaluate = function(tableModel, expression) {
        expression.tableModel = tableModel;

        var values = [];
        $.each(expression.args, function(index, arg) {
            var value;
            if (isExpression(arg)) {
                value = evaluate(tableModel, arg);
            } else if (isSelection(arg)) {
                value = [];
                $.each(arg.all(), function(i, cellIndex) {
                    var cellVal = tableModel.get(cellIndex[0], cellIndex[1])
                    if (cellVal !== undefined) {
                        value.push(cellVal);
                    }
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

    /**
     * Find a selection of all cells the expression depends on.
     */
    var findExpressionSourceSelection = function(expression) {
        var selections = [];
        $.each(expression.args, function(index, arg) {
            if (isSelection(arg)) {
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

    /**
     * Try to convert argument to number.
     *
     * Helper function used in expressions.
     */
    var asNumber = function(value) {
        var number = parseFloat(value);
        if (number == value) {
            return number;
        } else {
            return 0;
        }
    };

    /**
     * Default options for expression constructor.
     *
     * They are overridden using options argument of the constructor.
     */
    var defaultExpressionOptions = {
        flatten: false
    }

    /**
     * Base constructor of all expressions.
     *
     * @param args - all arguments passed to the expression
     * @param evaluateFunction
     * @param options - various options
     *
     * Options (see defaultExpression options):
     *   - flatten - when evaluating arguments, make a single array
     *     out of all argument values (default: false)
     *
     * Exported as TableModel.expression.Base.
     */
    var Expression = function(args, evaluateFunction, options) {
        this.args = args;
        this.sourceSelection = findExpressionSourceSelection(this);
        this.evaluate = evaluateFunction;
        this.options = $.extend({}, defaultExpressionOptions, options);
        $.extend(this, options);
    };

    /**
     * Namespace with pre-defined expressions.
     *
     * Also shortcut as TableModel.e.
     * If you want to implement a custom expression, use TableModel.expression.Base.
     */
    TableModel.expression = {
        Base: Expression,

        /**
         * Sum of a selection or values.
         */
        sum: function() {
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

        /**
          * Product of a selection or values.
          */
        product: function() {
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

        /**
          * Count all values satisfying a condition.
          * 
          * @param condition Can be a value or a Regexp
          *   - Regexp is checked for matching
          *   - value is checked for simple ==equality
          */
        countIf: function(selection, condition) {
            return new Expression([selection], function(values) {
                var count = 0;
                $.each(values, function(index, item) {
                    item = "" + item; // Force it to be string
                    if (condition instanceof RegExp && item.match(condition)) {
                        count++;
                    } else if (condition == item) {
                        count++;
                    }
                });
                return count;
            }, {
                flatten: true
            });
        },

        /**
         * Map sourcevalues => targetvalues using handler.
         *
         * @param selection Selection or an array of values
         * @param function(value, [row, column], tableModel) handler
         *   There are no limitation for the handler, it can be a generic function.
         * @return Array converted values as array
         *
         * If the first parameter is a selection, handler
         * receives row & column parameters as well.
         */
        map: function(selection, handler) {
            return new Expression([selection], function(values) {
                var result = [];
                var tableModel = this.tableModel;

                if (isSelection(selection)) {
                    $.each(selection.all(), function(index, item) {
                        var row = item[0];
                        var column = item[1];
                        var value = tableModel.get(row, column);
                        result.push(handler(value, tableModel, row, column));
                    });
                } else {
                    $.each(values, function(index, item) {
                        result.push(handler(item, tableModel));
                    });
                }
                return result;
            }, {
                flatten: true
            });
        }
    }

    // Shortcuts
    TableModel.s = TableModel.select;
    TableModel.e = TableModel.expression;

    // Export functions
    TableModel.labelCells = labelCells;

    // Make it a jQuery plugin
    $.fn.tableModel = function(options) {
        $.each(this, function() {
            new TableModel($(this), options);
        });
        return this;
    }
    $.extend($.fn.tableModel, TableModel);

    return TableModel;
})(jQuery);
