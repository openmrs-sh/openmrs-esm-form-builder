import React, { useCallback, useMemo, useState } from "react";
import { TFunction, useTranslation } from "react-i18next";
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
} from "@carbon/react";
import {
  Add,
  DocumentImport,
  Download,
  Edit,
  TrashCan,
} from "@carbon/react/icons";
import {
  FetchResponse,
  navigate,
  showNotification,
  showToast,
  useConfig,
  useLayoutType,
  usePagination,
} from "@openmrs/esm-framework";
import type { KeyedMutator } from "swr";

import type { Form as FormType } from "../../types";
import { deleteForm } from "../../forms.resource";
import { FormBuilderPagination } from "../pagination";
import { useClobdata } from "../../hooks/useClobdata";
import { useForms } from "../../hooks/useForms";
import EmptyState from "../empty-state/empty-state.component";
import ErrorState from "../error-state/error-state.component";
import styles from "./dashboard.scss";

type Mutator = KeyedMutator<{
  data: {
    results: Array<FormType>;
  };
}>;

type ActionButtonsProps = {
  form: FormType;
  mutate: Mutator;
  t: TFunction;
};

type FormsListProps = {
  forms: Array<FormType>;
  isValidating: boolean;
  mutate: Mutator;
  t: TFunction;
};

function CustomTag({ condition }: { condition: boolean }) {
  const { t } = useTranslation();

  if (condition) {
    return (
      <Tag type="green" size="md" title="Clear Filter" data-testid="yes-tag">
        {t("yes", "Yes")}
      </Tag>
    );
  }

  return (
    <Tag type="red" size="md" title="Clear Filter" data-testid="no-tag">
      {t("no", "No")}
    </Tag>
  );
}

function ActionButtons({ form, mutate, t }: ActionButtonsProps) {
  const { clobdata } = useClobdata(form);
  const formResources = form?.resources;
  const [showDeleteFormModal, setShowDeleteFormModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const downloadableSchema = useMemo(
    () =>
      new Blob([JSON.stringify(clobdata, null, 2)], {
        type: "application/json",
      }),
    [clobdata]
  );

  const handleDeleteForm = useCallback(
    (formUuid: string) => {
      deleteForm(formUuid)
        .then((res: FetchResponse) => {
          if (res.status === 204) {
            showToast({
              title: t("formDeleted", "Form deleted"),
              kind: "success",
              critical: true,
              description:
                `${form.name} ` +
                t("formDeletedSuccessfully", "deleted successfully"),
            });

            mutate();
            setShowDeleteFormModal(false);
          }
        })
        .catch((e: Error) =>
          showNotification({
            title: t("errorDeletingForm", "Error deleting form"),
            kind: "error",
            critical: true,
            description: e?.message,
          })
        )
        .finally(() => setIsDeleting(false));
    },
    [form.name, mutate, t]
  );

  const ImportButton = () => {
    return (
      <Button
        renderIcon={DocumentImport}
        onClick={() =>
          navigate({ to: `${window.spaBase}/form-builder/edit/${form.uuid}` })
        }
        kind={"ghost"}
        iconDescription={t("import", "Import")}
        hasIconOnly
      />
    );
  };

  const EditButton = () => {
    return (
      <Button
        enterDelayMs={300}
        renderIcon={Edit}
        onClick={() =>
          navigate({
            to: `${window.spaBase}/form-builder/edit/${form.uuid}`,
          })
        }
        kind={"ghost"}
        iconDescription={t("editSchema", "Edit schema")}
        hasIconOnly
        tooltipAlignment="start"
      />
    );
  };

  const DownloadSchemaButton = () => {
    return (
      <a
        download={`${form?.name}.json`}
        href={window.URL.createObjectURL(downloadableSchema)}
      >
        <Button
          className={styles.downloadButton}
          enterDelayMs={300}
          renderIcon={Download}
          kind={"ghost"}
          iconDescription={t("downloadSchema", "Download schema")}
          hasIconOnly
          tooltipAlignment="start"
        />
      </a>
    );
  };

  const DeleteButton = () => {
    return (
      <Button
        enterDelayMs={300}
        renderIcon={TrashCan}
        onClick={() => setShowDeleteFormModal(true)}
        kind={"ghost"}
        iconDescription={t("deleteSchema", "Delete schema")}
        hasIconOnly
        tooltipAlignment="start"
      />
    );
  };

  const DeleteFormModal = () => {
    return (
      <ComposedModal
        danger
        open={showDeleteFormModal}
        onClose={() => setShowDeleteFormModal(false)}
        preventCloseOnClickOutside
      >
        <ModalHeader title={t("deleteForm", "Delete form")} />
        <Form onSubmit={(event) => event.preventDefault()}>
          <ModalBody>
            <p>
              {t(
                "deleteFormConfirmation",
                "Are you sure you want to delete this form?"
              )}
            </p>
          </ModalBody>
        </Form>
        <ModalFooter>
          <Button
            kind="secondary"
            onClick={() => setShowDeleteFormModal(false)}
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            disabled={isDeleting}
            kind="danger"
            onClick={() => {
              setIsDeleting(true);
              handleDeleteForm(form.uuid);
            }}
          >
            {isDeleting ? (
              <InlineLoading
                className={styles.spinner}
                description={t("deleting", "Deleting") + "..."}
              />
            ) : (
              <span>{t("delete", "Delete")}</span>
            )}
          </Button>
        </ModalFooter>
      </ComposedModal>
    );
  };

  return (
    <>
      {formResources.length == 0 || !form?.resources[0] ? (
        <ImportButton />
      ) : (
        <>
          <EditButton />
          <DownloadSchemaButton />
        </>
      )}
      <DeleteButton />
      {setShowDeleteFormModal && <DeleteFormModal />}
    </>
  );
}

function FormsList({ forms, isValidating, mutate, t }: FormsListProps) {
  const config = useConfig();
  const isTablet = useLayoutType() === "tablet";
  const [filter, setFilter] = useState("");
  const [searchString, setSearchString] = useState("");
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    if (!filter) {
      return forms;
    }

    if (filter === "Published") {
      return forms.filter((form) => form.published);
    }

    if (filter === "Unpublished") {
      return forms.filter((form) => !form.published);
    }

    return forms;
  }, [filter, forms]);

  const tableHeaders = [
    {
      header: t("name", "Name"),
      key: "name",
    },
    {
      header: t("version", "Version"),
      key: "version",
    },
    {
      header: t("published", "Published"),
      key: "published",
    },
    {
      header: t("retired", "Retired"),
      key: "retired",
    },
    {
      header: t("schemaActions", "Schema actions"),
      key: "actions",
    },
  ];

  const searchResults = useMemo(() => {
    if (searchString && searchString.trim() !== "") {
      return filteredRows.filter((form) =>
        form.name.toLowerCase().includes(searchString.toLowerCase())
      );
    }

    return filteredRows;
  }, [searchString, filteredRows]);

  const { paginated, goTo, results, currentPage } = usePagination(
    searchResults,
    pageSize
  );

  const tableRows = results?.map((form: FormType) => ({
    ...form,
    id: form?.uuid,
    published: <CustomTag condition={form?.published} />,
    retired: <CustomTag condition={form?.retired} />,
    actions: <ActionButtons form={form} mutate={mutate} t={t} />,
  }));

  const handlePublishStatusChange = ({
    selectedItem,
  }: {
    selectedItem: string;
  }) => setFilter(selectedItem);

  const handleSearch = useCallback(
    (e) => {
      goTo(1);
      setSearchString(e.target.value);
    },
    [goTo, setSearchString]
  );

  return (
    <>
      {config.showSchemaSaveWarning && (
        <InlineNotification
          className={styles.warningMessage}
          kind="info"
          lowContrast
          title={t(
            "schemaSaveWarningMessage",
            "The dev3 server is ephemeral at best and can't be relied upon to save your schemas permanently. To avoid losing your work, please save your schemas to your local machine. Alternatively, upload your schema to the distro repo to have it persisted across server resets."
          )}
        />
      )}
      <div className={styles.flexContainer}>
        <div className={styles.filterContainer}>
          <Dropdown
            id="publishStatusFilter"
            initialSelectedItem={"All"}
            label=""
            titleText={
              t("filterByPublishedStatus", "Filter by publish status") + ":"
            }
            type="inline"
            items={["All", "Published", "Unpublished"]}
            onChange={handlePublishStatusChange}
          />
        </div>
        <div className={styles.backgroundDataFetchingIndicator}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
        </div>
      </div>
      <DataTable
        rows={tableRows}
        headers={tableHeaders}
        size={isTablet ? "sm" : "lg"}
        useZebraStyles
      >
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <>
            <TableContainer
              className={styles.tableContainer}
              data-testid="forms-table"
            >
              <div className={styles.toolbarWrapper}>
                <TableToolbar className={styles.tableToolbar}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      onChange={handleSearch}
                      placeholder={t("searchThisList", "Search this list")}
                    />
                    <Button
                      kind="primary"
                      iconDescription={t("createNewForm", "Create a new form")}
                      renderIcon={(props) => <Add size={16} {...props} />}
                      onClick={() =>
                        navigate({
                          to: `${window.spaBase}/form-builder/new`,
                        })
                      }
                    >
                      {t("createNewForm", "Create a new form")}
                    </Button>
                  </TableToolbarContent>
                </TableToolbar>
              </div>
              <Table {...getTableProps()} className={styles.table}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      {...getRowProps({ row })}
                      data-testid={`form-row-${row.id}`}
                    >
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>
                      {t(
                        "noMatchingFormsToDisplay",
                        "No matching forms to display"
                      )}
                    </p>
                    <p className={styles.helper}>
                      {t("checkFilters", "Check the filters above")}
                    </p>
                  </div>
                </Tile>
              </div>
            ) : null}
          </>
        )}
      </DataTable>
      {paginated && (
        <FormBuilderPagination
          currentItems={results.length}
          totalItems={searchResults.length}
          onPageNumberChange={({ page }) => {
            goTo(page);
          }}
          pageNumber={currentPage}
          pageSize={pageSize}
        />
      )}
    </>
  );
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { error, forms, isLoading, isValidating, mutate } = useForms();

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>{t("formBuilder", "Form Builder")}</h3>
      {(() => {
        if (error) {
          return <ErrorState error={error} />;
        }

        if (isLoading) {
          return <DataTableSkeleton role="progressbar" />;
        }

        if (forms.length === 0) {
          return <EmptyState />;
        }

        return (
          <FormsList
            forms={forms}
            isValidating={isValidating}
            mutate={mutate}
            t={t}
          />
        );
      })()}
    </div>
  );
};

export default Dashboard;
