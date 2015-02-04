/**
 * designed by Luke & coded by Avi, 2015.
 */

(function ($) {

    $.fn.lookup = function (options) {

        var settings = $.extend({}, $.fn.lookup.defaults, options);

        var targetElements = this.filter("textarea").not(".transformed-textarea");
        targetElements.each(function (i, targetElement) {

            function _showModalDialog(event) {
				var modalDialog = $($.parseHTML($.fn.lookup.modalMarkup)).appendTo("body").modal('hide');

				//Create Query Fields
				var defaultQueryfield = modalDialog.find(".default-queryfield").removeClass("default-queryfield");
				var queryFieldList = settings.Queryfields.split(",");
				$.each(queryFieldList, function (qi, queryField) {
					var cloneField = defaultQueryfield.clone(true, false);
					cloneField.find(".lookup-textfield").data("queryFieldName", queryField).prop("placeholder", "Enter " + queryField);
					defaultQueryfield.parent().append(cloneField);
				});
				defaultQueryfield.remove();

				//Events...
				//Attach click event on search
				modalDialog.find(".btn.btn-find").on("click.search", _search);
				//disable the Add to List button initially and attach the click event on Add to List
				modalDialog.find(".btn-addtolist").prop("disabled", true)
					.off("click.addToList").one("click.addToList", _addToList);

				//Attach keyUp event for enter key on lookup-searchTextBox and enabling find button
				modalDialog.find(".lookup-textfield").on("keyup", function (event) {
					//enable find button
					var doDisableFind = true;
					modalDialog.find(".lookup-textfield").each(function (i, textFieldElement) {
						if ($.trim(textFieldElement.value) !== "") {
							//Found a textfield with some value
							modalDialog.find(".btn.btn-find").prop("disabled", false);
							doDisableFind = false;
							return false;
						}
					});
					//Check if all empty, disable the find button again
					if (doDisableFind) {
						modalDialog.find(".btn.btn-find").prop("disabled", true);
					}
					//If user hits enter and find button is enabled, search
					if (event.keyCode === 13 && !modalDialog.find(".btn.btn-find").prop("disabled")) {
						_search();
					}
				});

				//Attach partial/exact functionality events
				modalDialog.find(".lookup-searchtype-dropdown a").on("click", function (event) {
					event.preventDefault();
					var selectedValue = this.innerHTML;
					$(this).closest(".lookup-searchtype-dropdown").find("button").html(selectedValue);
					$(this).closest(".lookup-searchtype-dropdown").find(".active").removeClass("active");
					$(this).parent().addClass("active");
				});

				//Attach close event on modal popup
				modalDialog.on("hidden.bs.modal", function () {
					//to reset modal dialog
					modalDialog.remove();
				});

				//prevent form submission - this was otherwise causing page refresh (form submission)
				modalDialog.find("form").on("submit", function (event) {
					if (event && event.preventDefault) {
						event.preventDefault();
					}
				});

				modalDialog.modal('show');

                //Stop default behaviour of the Lookup button
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
            }

            function _addToList() {
                var modalDialog = $('#lookupModal').modal('hide');
                var _list = [];
                var delimiter = $.trim(settings.Separator);
                //if appendToList is set to true, ADD to list. Otherwise, we SET to list
                if (settings.appendToList) {
                    var existingList = targetElement.value;
                    if (existingList) {
                        _list = $.trim(existingList).split(delimiter);
                        _list = _list.map(function (s) {
                            return $.trim(s);
                        });
                    }
                }
                modalDialog.find(".search-result_checkbox:checked").each(function (i, checkBox) {
                    if (_list.indexOf(checkBox.value) === -1) {
                        _list.push(checkBox.value);
                    }
                });
                targetElement.value = (_list.length > 0) ? _list.join(settings.Separator) : "";
            }

            function _search(event) {
                var popup = $('#lookupModal');
                var queryText = "";
                popup.find(".lookup-textfield").each(function (i, lookupTextfield) {
                    var searchText = $(lookupTextfield).val();
                    if (searchText !== "") {
                        var searchType = $.trim($(lookupTextfield).parent().find(".lookup-searchtype-dropdown button").html());
                        if (searchType === "Partial") {
                            searchText = "*" + searchText + "*";
                        }
                        if (queryText !== "") {
                            queryText += " AND ";
                        }
                        queryText += $(lookupTextfield).data("queryFieldName") + ":" + searchText;
                    }
                });

                //clear previous search
                popup.find("table").remove();

                //Hide alert and clear info text
                popup.find(".lookup-alert").removeClass("lookup-alert--visible");
                popup.find(".lookup-info").html("");
                popup.find(".lookup-success").html("").addClass("lookup-success--hidden");

                //Show loading indicator
                popup.find(".btn.btn-find").button("loading");
                popup.find(".lookup-loading-indicator").removeClass("lookup-loading-indicator__hidden");

                popup.find(".lookup-results-section").removeClass("lookup-results-section--hidden");

                //Make the rest service call
                $.ajax({
                    "url": settings.restURL,
                    "data": $.extend({}, {
                        "q": queryText,
                        "limit": settings.Limit,
                        "species": settings.Species
                    }, settings.additionalParams),
                    "dataType": "json"
                }).done(settings.renderSearchResults || _renderSearchResults).complete(function () {
                    popup.find(".btn.btn-find").button("reset");
                    popup.find(".lookup-loading-indicator").addClass("lookup-loading-indicator__hidden");
                }).fail(function () {
                    popup.find(".lookup-alert").addClass("lookup-alert--visible");
                });

                if (event && event.preventDefault) {
                    event.preventDefault();
                }
            }

            function _renderSearchResults(resultsJSON) {
                var popup = $('#lookupModal');
                var tableContainer = popup.find(".table-responsive");

                //Create a table to render all results
                if (resultsJSON.total > 0) {
                    var resultMarkup = "<table class=\"table table-striped\"><thead><tr>";
                    var identifier = settings.Identifier;

                    var successMessage = resultsJSON.total + " matches found" +
                        ((resultsJSON.total > settings.Limit) ? (", " + settings.Limit + " results displayed") : "") +
                        ". <a href=\"#\" class=\"clear-results-link\">Clear results</a>";

                    popup.find(".lookup-success").html(successMessage).removeClass("lookup-success--hidden");
                    popup.find(".lookup-success a.clear-results-link").click(function (event) {
                        event.preventDefault();
                        popup.find(".lookup-success").html("").addClass("lookup-success--hidden");
                        popup.find("table").remove();
                        popup.find(".btn-addtolist").prop("disabled", true);
                        popup.find(".lookup-results-section").addClass("lookup-results-section--hidden");
                    });

                    //Construct the column head

                    //First column - the select-all checkbox
                    resultMarkup += "<th><input type=\"checkbox\" class=\"lookup-select-all\"></th>";
                    //second column - the identifier
                    resultMarkup += "<th>" + toTitleCase(identifier) + "</th>";
                    //other columns
                    $.each(settings.resultTableColumns, function (i, col) {
                        if (col !== identifier) {
                            resultMarkup += "<th>" + toTitleCase(col) + "</th>";
                        }
                    });
                    resultMarkup += "</tr></thead><tbody>";

                    //construct the rows
                    $.each(resultsJSON.hits, function (i, resObj) {
                        resultMarkup += "<tr>";

                        //The first row containing checkbox
                        if (resObj[identifier] == undefined || resObj[identifier] == null) {
                            throw new error("Lookup: Invalid identifier");
                        }
                        resultMarkup += "<td><input type=\"checkbox\" value=\"" + resObj[identifier] + "\" class=\"search-result_checkbox\"> </td>";

                        //The second row should be the identifier
                        resultMarkup += "<td>" + resObj[identifier] + "</td>";

                        //Now continue to render other rows
                        $.each(settings.resultTableColumns, function (i, col) {
                            if (col !== identifier) {
                                resultMarkup += "<td>" + resObj[col] + "</td>";
                            }
                        });
                        resultMarkup += "</tr>";
                    });

                    resultMarkup += "</tbody></table>";
                    tableContainer.append(resultMarkup);

                    var checkBoxes = tableContainer.find(".search-result_checkbox");
                    var selectAllCheckBox = tableContainer.find(".lookup-select-all");
                    //add event to checkboxes
                    checkBoxes.on("change", function () {
						popup.find(".btn-addtolist").prop("disabled", false);
                        //Event to keep select/deselect all button in sync
                        if (checkBoxes.not(":checked").length > 0) {
                            //Atleast one of the checkboxes is not selected
                            selectAllCheckBox.prop("checked", false);
							if(checkBoxes.filter(":checked").length === 0){
								//None are checked - disable the add to list button
								popup.find(".btn-addtolist").prop("disabled", true);
							}
                        } else if (checkBoxes.not(":checked").length === 0) {
                            //All selected
                            selectAllCheckBox.prop("checked", true);
                        }
                    });

                    //Select all/deselect all functionality
                    selectAllCheckBox.on("change", function () {
                        //set the checked state
                        checkBoxes.prop("checked", selectAllCheckBox.prop("checked"))
                            //and trigger the change event to enable the "Add to Cart" button
                            .filter(":first").trigger("change");
                    });
                } else {
                    tableContainer.find(".lookup-alert").addClass("lookup-alert--visible");
                }
            }

            function _transformTextArea(textAreaElement) {
                var markupString = $.fn.lookup.transformOptions.markup;
                var additionalClasses = $.fn.lookup.transformOptions.extraTextareaClasses;
                $(textAreaElement).addClass(additionalClasses).addClass("transformed-textarea");
                var wrapElement = $.parseHTML($.trim(markupString));
                $(textAreaElement).replaceWith(wrapElement);

                //Add the textarea back
                $(wrapElement).find(":not(iframe)").addBack().contents().filter(function () {
                    return this.nodeType == 3;
                }).each(function (i, el) {
                    if ($.trim(el.textContent) === "@textarea") {
                        $(el).replaceWith(textAreaElement);
                        return false;
                    }
                });
				
				//fix appearance
				var lookupHeight = $(wrapElement).find(".navbar-lookup").css("height");
				$(wrapElement).find("textarea.transformed-textarea").css("top",lookupHeight);
				var textAreaHeight = $(wrapElement).find("textarea.transformed-textarea").css("height");
				var totalHeight = parseInt(lookupHeight.replace("px", "")) + parseInt(textAreaHeight.replace("px", ""));
				$(wrapElement).css("height", totalHeight);

                return $(wrapElement);
            }

            //A utility function, can be moved out the scope to use elsewhere
            function toTitleCase(str) {
                return str.replace(/\w\S*/g, function (txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
            }

            //Do transform
            (function ($) {
                var eRef = _transformTextArea(targetElement);

                //Add modal dialog event
                var button = eRef.find(".btn-lookup");
                if (button.length === 0) {
                    //if no button exists with class btn-lookup, look for other possible button
                    button = eRef.find("button, input[type = button], .btn").filter(":first");
                }
                button.on('click', _showModalDialog);
            })($);
        });

        return this;
    };

    //The default configuration
    $.fn.lookup.defaults = {

        /**
         * resultTableColumns - This array represents table columns. An identifier will always be displayed regardless
         * of it's presence here.
         */
        "resultTableColumns": [
            "symbol",
            "name"
        ],
        /* URL for rest service */
        "restURL": "http://mygene.info/v2/query",

        /* Additional parameters that should be sent along with the REST request*/
        "additionalParams": {},

        /**
         *  A boolean flag for appending decision i.e. whether selected search results should be appended
         *  to the items already in textarea (true) or if the new results should replace the existing ones (false)
         */
        "appendToList": true,

        /**
         * The delimiter character (or string) to be used for splitting selected results.
         */
        "Separator": "\n",

        /**
         * The species to be queried.
         */
        "Species": "human",

        /**
         * Unknown
         */
        "Identifier": "symbol",

        /**
         * Maximum number of results to request
         */
        "Limit": 100,

        /**
         * The field(s) against which query should run
         */
        "Queryfields": "name"
    };

    //The default look of transformed textarea
    $.fn.lookup.transformOptions = {
        //The HTML markup that replaces the browser default textarea.
        "markup": "\
            <div class=\"lookup-wrap\">\
                @textarea\
				<nav class=\"nav navbar-default navbar-lookup\">\
                    <button class=\"btn btn-default btn-sm btn-lookup\">\
                        <span class=\"glyphicon glyphicon-search\"></span> Lookup\
                    </button>\
                </nav>\
            </div>\
        ",
        //Any css classes you might want to add to the textarea after transformation
        "extraTextareaClasses": ""
    };
	
	$.fn.lookup.modalMarkup = '\
		<div class="modal fade" id="lookupModal">\
			<div class="modal-dialog modal-lg">\
				<div class="modal-content">\
					<div class="modal-header">\
						<button type="button" class="close" data-dismiss="modal" aria-label="Close">\
							<span aria-hidden="true">&times;</span>\
						</button>\
						<h4 class="modal-title">Lookup</h4>\
					</div>\
					<div class="modal-body">\
						<section class="lookup-form-section">\
							<form>\
								<div class="row">\
									<div class="form-input-container_lookup col-md-10">\
										<div class="form-group default-queryfield">\
											<div class="input-group">\
												<div class="input-group-btn lookup-searchtype-dropdown">\
													<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-expanded="false">\
														Partial\
													</button>\
													<ul class="dropdown-menu" role="menu">\
														<li class="active" role="presentation"><a href="#">Partial</a></li>\
														<li role="presentation"><a href="#">Exact</a></li>\
													</ul>\
												</div>\
												<input type="text" class="form-control lookup-textfield"/>\
											</div>\
										</div>\
									</div>\
									<div class="col-md-2">\
										<button disabled="" type="button" class="btn btn-primary btn-find btn-block" data-loading-text="Finding...">Find</button>\
									</div>\
								</div>\
								<div class="row">\
									<div class="col-md-12">\
										<p class="text-info lookup-info">\
											Type gene names or keywords, i.e. "cancer", "BRCA1"\
										</p>\
									</div>\
								</div>\
							</form>\
						</section>\
						<section class="lookup-results-section lookup-results-section--hidden">\
							<img src="images/loading.gif" class="lookup-loading-indicator lookup-loading-indicator__hidden"/>\
							<div class="alert alert-success lookup-success lookup-success--hidden">\
							</div>\
							<div class="table-responsive">\
								<div class="alert alert-danger lookup-alert" role="alert">\
									No results found. Try different keywords.\
								</div>\
							</div>\
						</section>\
					</div>\
					<div class="modal-footer">\
						<button type="button" class="btn btn-primary btn-addtolist" disabled="disabled">Add to List</button>\
						<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\
					</div>\
				</div>\
			</div>\
		</div>\
	';

    $("[data-textarea]").lookup();
})(jQuery, window);
