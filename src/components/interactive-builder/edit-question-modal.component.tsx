import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  ComposedModal,
  Form,
  FormGroup,
  FormLabel,
  Layer,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  MultiSelect,
  RadioButton,
  RadioButtonGroup,
  Search,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextInput,
  Tile,
} from "@carbon/react";
import { ArrowUpRight } from "@carbon/react/icons";
import debounce from "lodash-es/debounce";
import flattenDeep from "lodash-es/flattenDeep";
import { showNotification, showToast, useConfig } from "@openmrs/esm-framework";
import type { RenderType } from "@openmrs/openmrs-form-engine-lib";

import type { Concept, ConceptMapping, Question, Schema } from "../../types";
import { useConceptLookup } from "../../hooks/useConceptLookup";
import { useConceptName } from "../../hooks/useConceptName";
import styles from "./question-modal.scss";

type EditQuestionModalProps = {
  onModalChange: (showModal: boolean) => void;
  onQuestionEdit: (question: Question) => void;
  onSchemaChange: (schema: Schema) => void;
  pageIndex: number;
  questionIndex: number;
  questionToEdit: Question;
  resetIndices: () => void;
  schema: Schema;
  sectionIndex: number;
  showModal: boolean;
};

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  questionToEdit,
  schema,
  onSchemaChange,
  pageIndex,
  sectionIndex,
  questionIndex,
  resetIndices,
  showModal,
  onModalChange,
  onQuestionEdit,
}) => {
  const { t } = useTranslation();
  const { fieldTypes, questionTypes } = useConfig();
  const [max, setMax] = useState("");
  const [min, setMin] = useState("");
  const [questionLabel, setQuestionLabel] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [isQuestionRequired, setIsQuestionRequired] = useState(false);
  const [fieldType, setFieldType] = useState<RenderType>(null);
  const [questionId, setQuestionId] = useState("");
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [conceptMappings, setConceptMappings] = useState<ConceptMapping[]>(
    questionToEdit.questionOptions.conceptMappings
  );
  const [rows, setRows] = useState(2);
  const [conceptToLookup, setConceptToLookup] = useState("");
  const [answersFromConcept, setAnswersFromConcept] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const { concepts, isLoadingConcepts } = useConceptLookup(conceptToLookup);
  const { conceptName, isLoadingConceptName } = useConceptName(
    questionToEdit.questionOptions.concept
  );
  const [answersChanged, setAnswersChanged] = useState(false);

  const hasConceptChanged =
    selectedConcept &&
    questionToEdit?.questionOptions?.concept !== selectedConcept;

  const debouncedSearch = useMemo(
    () => debounce((searchTerm) => setConceptToLookup(searchTerm), 500),
    []
  );

  const handleConceptChange = (searchTerm: string) => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    }
  };

  const handleConceptSelect = (concept: Concept) => {
    setConceptToLookup("");
    setSelectedAnswers([]);
    setSelectedConcept(concept);
    setConceptMappings(
      concept?.mappings?.map((conceptMapping) => {
        const data = conceptMapping.display.split(": ");
        return {
          relationship: conceptMapping.conceptMapType.display,
          type: data[0],
          value: data[1],
        };
      })
    );
    setAnswersFromConcept(
      concept?.answers?.length
        ? concept.answers.map((answer) => ({
            concept: answer?.uuid,
            label: answer?.display,
          }))
        : []
    );
  };

  const questionIdExists = (idToTest: string) => {
    if (questionToEdit?.id === idToTest) {
      return false;
    }

    const nestedIds = schema?.pages?.map((page) => {
      return page?.sections?.map((section) => {
        return section?.questions?.map((question) => {
          return question.id;
        });
      });
    });

    const questionIds = flattenDeep(nestedIds);

    return questionIds.includes(idToTest);
  };

  const handleUpdateQuestion = () => {
    updateQuestion(questionIndex);
  };

  const updateQuestion = (questionIndex: number) => {
    let mappedAnswers = [];

    if (!hasConceptChanged && selectedAnswers?.length) {
      mappedAnswers = selectedAnswers.map((answer) => ({
        concept: answer.id,
        label: answer.text,
      }));
    } else if (hasConceptChanged && answersFromConcept.length === 0) {
      mappedAnswers = [];
    } else if (
      hasConceptChanged &&
      answersFromConcept?.length > 0 &&
      selectedAnswers?.length
    ) {
      mappedAnswers = selectedAnswers?.length
        ? selectedAnswers.map((answer) => ({
            concept: answer.id,
            label: answer.text,
          }))
        : questionToEdit.questionOptions.answers;
    } else {
      mappedAnswers = questionToEdit.questionOptions.answers;
    }

    try {
      const data = {
        label: questionLabel ? questionLabel : questionToEdit.label,
        type: questionType ? questionType : questionToEdit.type,
        required: isQuestionRequired
          ? isQuestionRequired
          : /true/.test(questionToEdit?.required?.toString()),
        id: questionId ? questionId : questionToEdit.id,
        questionOptions: {
          rendering: fieldType
            ? fieldType
            : questionToEdit.questionOptions.rendering,
          concept: selectedConcept?.uuid
            ? selectedConcept.uuid
            : questionToEdit.questionOptions.concept,
          conceptMappings: conceptMappings?.length
            ? conceptMappings
            : questionToEdit.questionOptions.conceptMappings,
          answers: mappedAnswers,
        },
      };

      schema.pages[pageIndex].sections[sectionIndex].questions[questionIndex] =
        data;
      onSchemaChange({ ...schema });
      resetIndices();
      setQuestionLabel("");
      setQuestionId("");
      setIsQuestionRequired(false);
      setQuestionType(null);
      setFieldType(null);
      setSelectedConcept(null);
      setConceptMappings([]);
      setSelectedAnswers([]);
      onQuestionEdit(null);
      showToast({
        title: t("success", "Success!"),
        kind: "success",
        critical: true,
        description: t("questionUpdated", "Question updated"),
      });
      onModalChange(false);
    } catch (error) {
      showNotification({
        title: t("errorUpdatingQuestion", "Error updating question"),
        kind: "error",
        critical: true,
        description: error?.message,
      });
    }
  };

  return (
    <ComposedModal
      open={showModal}
      onClose={() => onModalChange(false)}
      preventCloseOnClickOutside
    >
      <ModalHeader title={t("editQuestion", "Edit question")} />
      <Form
        className={styles.form}
        onSubmit={(event) => event.preventDefault()}
      >
        <ModalBody hasScrollingContent>
          <FormGroup legendText={""}>
            <Stack gap={5}>
              <TextInput
                defaultValue={questionToEdit.label}
                id={questionToEdit.id}
                labelText={t("questionLabel", "Label")}
                onChange={(event) => setQuestionLabel(event.target.value)}
                required
              />

              <TextInput
                defaultValue={questionToEdit.id}
                id="questionId"
                invalid={questionIdExists(questionId)}
                invalidText={t(
                  "questionIdExists",
                  "This question ID already exists in your schema"
                )}
                labelText={t(
                  "questionId",
                  "Question ID (prefer using camel-case for IDs)"
                )}
                onChange={(event) => setQuestionId(event.target.value)}
                placeholder={t(
                  "questionIdPlaceholder",
                  'Enter a unique ID e.g. "anaesthesiaType" for a question asking about the type of anaesthesia.'
                )}
                required
              />

              <RadioButtonGroup
                defaultSelected={
                  /true/.test(questionToEdit?.required?.toString())
                    ? "required"
                    : "optional"
                }
                name="isQuestionRequired"
                legendText={t(
                  "isQuestionRequiredOrOptional",
                  "Is this question a required or optional field? Required fields must be answered before the form can be submitted."
                )}
              >
                <RadioButton
                  id="questionIsNotRequired"
                  defaultChecked={true}
                  labelText={t("optional", "Optional")}
                  onClick={() => setIsQuestionRequired(false)}
                  value="optional"
                />
                <RadioButton
                  id="questionIsRequired"
                  defaultChecked={false}
                  labelText={t("required", "Required")}
                  onClick={() => setIsQuestionRequired(true)}
                  value="required"
                />
              </RadioButtonGroup>

              <Select
                defaultValue={questionToEdit.type}
                onChange={(event) => setQuestionType(event.target.value)}
                id={"questionType"}
                invalidText={t("typeRequired", "Type is required")}
                labelText={t("questionType", "Question type")}
                required
              >
                {!questionType && (
                  <SelectItem
                    text={t("chooseQuestionType", "Choose a question type")}
                    value=""
                  />
                )}
                {questionTypes.map((questionType, key) => (
                  <SelectItem
                    text={questionType}
                    value={questionType}
                    key={key}
                  />
                ))}
              </Select>

              <Select
                defaultValue={questionToEdit.questionOptions.rendering}
                onChange={(event) => setFieldType(event.target.value)}
                id="renderingType"
                invalidText={t(
                  "validFieldTypeRequired",
                  "A valid field type value is required"
                )}
                labelText={t("fieldType", "Field type")}
                required
              >
                {!fieldType && (
                  <SelectItem
                    text={t("chooseFieldType", "Choose a field type")}
                    value=""
                  />
                )}
                {fieldTypes.map((fieldType, key) => (
                  <SelectItem text={fieldType} value={fieldType} key={key} />
                ))}
              </Select>

              {fieldType === "number" ? (
                <>
                  <TextInput
                    id="min"
                    labelText="Min"
                    value={min || ""}
                    onChange={(event) => setMin(event.target.value)}
                    required
                  />
                  <TextInput
                    id="max"
                    labelText="Max"
                    value={max || ""}
                    onChange={(event) => setMax(event.target.value)}
                    required
                  />
                </>
              ) : fieldType === "textarea" ? (
                <TextInput
                  id="textAreaRows"
                  labelText={t("rows", "Rows")}
                  value={rows || ""}
                  onChange={(event) => setRows(event.target.value)}
                  required
                />
              ) : null}

              {fieldType !== "ui-select-extended" && (
                <div>
                  <FormLabel className={styles.label}>
                    {t(
                      "searchForBackingConcept",
                      "Search for a backing concept"
                    )}
                  </FormLabel>
                  {isLoadingConceptName ? (
                    <InlineLoading
                      className={styles.loader}
                      description={t("loading", "Loading") + "..."}
                    />
                  ) : (
                    <>
                      <Search
                        defaultValue={conceptName}
                        id="conceptLookup"
                        onClear={() => setSelectedConcept(null)}
                        onChange={(e) =>
                          handleConceptChange(e.target.value?.trim())
                        }
                        placeholder={t(
                          "searchConcept",
                          "Search using a concept name or UUID"
                        )}
                        required
                        size="md"
                        value={selectedConcept?.display}
                      />
                      {(() => {
                        if (!conceptToLookup) return null;
                        if (isLoadingConcepts)
                          return (
                            <InlineLoading
                              className={styles.loader}
                              description={t("searching", "Searching") + "..."}
                            />
                          );
                        if (
                          concepts &&
                          concepts?.length &&
                          !isLoadingConcepts
                        ) {
                          return (
                            <ul className={styles.conceptList}>
                              {concepts?.map((concept, index) => (
                                <li
                                  role="menuitem"
                                  className={styles.concept}
                                  key={index}
                                  onClick={() => handleConceptSelect(concept)}
                                >
                                  {concept.display}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <Layer>
                            <Tile className={styles.emptyResults}>
                              <span>
                                {t(
                                  "noMatchingConcepts",
                                  "No concepts were found that match"
                                )}{" "}
                                <strong>"{conceptToLookup}".</strong>
                              </span>
                            </Tile>

                            <div className={styles.oclLauncherBanner}>
                              {
                                <p className={styles.bodyShort01}>
                                  {t(
                                    "conceptSearchHelpText",
                                    "Can't find a concept?"
                                  )}
                                </p>
                              }
                              <a
                                className={styles.oclLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                href={"https://app.openconceptlab.org/"}
                              >
                                {t("searchInOCL", "Search in OCL")}
                                <ArrowUpRight size={16} />
                              </a>
                            </div>
                          </Layer>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {conceptMappings && conceptMappings.length ? (
                <FormGroup>
                  <FormLabel className={styles.label}>
                    {t("mappings", "Mappings")}
                  </FormLabel>
                  <table className={styles.tableStriped}>
                    <thead>
                      <tr>
                        <th>{t("relationship", "Relationship")}</th>
                        <th>{t("source", "Source")}</th>
                        <th>{t("code", "Code")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conceptMappings.map((mapping, index) => (
                        <tr key={`mapping-${index}`}>
                          <td>{mapping.relationship ?? "--"}</td>
                          <td>{mapping.type ?? "--"}</td>
                          <td>{mapping.value ?? "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </FormGroup>
              ) : null}

              {!hasConceptChanged &&
              questionToEdit?.questionOptions?.answers &&
              questionToEdit?.questionOptions.answers?.length ? (
                <MultiSelect
                  className={styles.multiSelect}
                  direction="top"
                  id="selectAnswers"
                  itemToString={(item) => item.text}
                  initialSelectedItems={questionToEdit?.questionOptions?.answers?.map(
                    (answer) => ({
                      id: answer.concept,
                      text: answer.label,
                    })
                  )}
                  items={questionToEdit?.questionOptions?.answers?.map(
                    (answer) => ({
                      id: answer.concept,
                      text: answer.label,
                    })
                  )}
                  onChange={({ selectedItems }) => {
                    setAnswersChanged(true);
                    setSelectedAnswers(selectedItems.sort());
                  }}
                  size="md"
                  titleText={t(
                    "selectAnswersToDisplay",
                    "Select answers to display"
                  )}
                />
              ) : null}

              {!hasConceptChanged &&
              questionToEdit?.questionOptions?.answers?.length &&
              !answersChanged ? (
                <div>
                  {questionToEdit?.questionOptions?.answers?.map((answer) => (
                    <Tag
                      className={styles.tag}
                      key={answer?.concept}
                      type={"blue"}
                    >
                      {answer?.label}
                    </Tag>
                  ))}
                </div>
              ) : null}

              {hasConceptChanged && answersFromConcept.length ? (
                <MultiSelect
                  className={styles.multiSelect}
                  direction="top"
                  id="selectAnswers"
                  itemToString={(item) => item.text}
                  items={answersFromConcept.map((answer) => ({
                    id: answer.concept,
                    text: answer.label,
                  }))}
                  onChange={({ selectedItems }) =>
                    setSelectedAnswers(selectedItems.sort())
                  }
                  size="md"
                  titleText={t(
                    "selectAnswersToDisplay",
                    "Select answers to display"
                  )}
                />
              ) : null}

              {(hasConceptChanged || answersChanged) && (
                <div>
                  {selectedAnswers.map((selectedAnswer) => (
                    <Tag
                      className={styles.tag}
                      key={selectedAnswer.id}
                      type={"blue"}
                    >
                      {selectedAnswer.text}
                    </Tag>
                  ))}
                </div>
              )}
            </Stack>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => onModalChange(false)} kind="secondary">
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={handleUpdateQuestion}>
            <span>{t("save", "Save")}</span>
          </Button>
        </ModalFooter>
      </Form>
    </ComposedModal>
  );
};

export default EditQuestionModal;
