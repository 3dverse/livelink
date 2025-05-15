//------------------------------------------------------------------------------
import React, { CSSProperties, useEffect, useState } from "react";
import { Entity, RenderGraphDataObject } from "@3dverse/livelink";
import { getAssetDescription, setUserToken } from "@3dverse/api";
import { FaArrowRotateLeft, FaFolder, FaFolderOpen } from "react-icons/fa6";

//------------------------------------------------------------------------------
import { Icon } from "../../components-common/Icon";
import { Button } from "../../components-common/Button";
import { IconButton } from "../../components-common/IconButton";
import { Tooltip } from "../../components-common/Tooltip";
import { Spinner } from "../../components-common/Spinner";
import { Checkbox } from "../../components-common/Checkbox";
import { FormControlWidget } from "../../components-common/FormControlWidget";
import { AccordionItem, AccordionButton, AccordionPanel } from "../../components-common/Accordion";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
type Category = { name?: string; description: Input[]; categories: Category[]; mainAttribute?: Input };

//------------------------------------------------------------------------------
type Input = {
    type: string;
    nativeType: string;
    value: any;
    default: any;
    name: string;
    description: string;
    categories: string[];
};

//------------------------------------------------------------------------------
export const RenderGraphSettings = ({
    userToken,
    cameraEntity,
}: {
    userToken: string;
    cameraEntity: Entity | null;
}) => {
    //--------------------------------------------------------------------------
    const [originalDataJSON, setOriginalDataJSON] = useState<RenderGraphDataObject | undefined>(
        cameraEntity?.camera?.dataJSON,
    );
    const [dataJSON, setDataJSON] = useState(cameraEntity?.camera?.dataJSON);
    const [renderGraphDescription, setRenderGraphDescription] = useState<Category | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        const getRenderGraphDesciption = async () => {
            if (!cameraEntity?.camera) {
                return null;
            }
            const renderGraphRef = cameraEntity.camera.renderGraphRef;
            if (!renderGraphRef) {
                console.error("No render graph ref");
                return null;
            }
            // Get render graph description
            setUserToken(userToken);
            const { data: renderGraphDescription } = await getAssetDescription({
                asset_id: renderGraphRef,
                asset_container: "render_graphs",
            });
            if (!renderGraphDescription) {
                console.error("No render graph description");
                return null;
            }
            // Group by categories
            const inputDescriptorsGroupedByCategories = computeCategories(
                renderGraphDescription.inputDescriptor as Input[],
            );

            setOriginalDataJSON({ ...cameraEntity.camera.dataJSON });
            setDataJSON(cameraEntity.camera.dataJSON);
            setRenderGraphDescription(inputDescriptorsGroupedByCategories);
        };
        getRenderGraphDesciption();
    }, [userToken, cameraEntity]);

    //--------------------------------------------------------------------------
    const onChange = (attributeName: string, attributeValue: RenderGraphDataObject[string]) => {
        if (!cameraEntity?.camera?.dataJSON) {
            return null;
        }

        cameraEntity.camera.dataJSON[attributeName] = attributeValue;
        setDataJSON({ ...cameraEntity.camera.dataJSON });
    };

    //--------------------------------------------------------------------------
    const onResetInput = (attributeName: string, defaultValue: RenderGraphDataObject[string]) => {
        onChange(attributeName, defaultValue);
    };

    //--------------------------------------------------------------------------
    const onResetAllInputs = () => {
        if (!cameraEntity?.camera?.dataJSON) {
            return;
        }

        cameraEntity.camera.dataJSON = originalDataJSON ?? {};
        setDataJSON(originalDataJSON);
    };

    //--------------------------------------------------------------------------
    const renderCategory = (category: Category, lineageIndex = 0, rootKey = "") => {
        return (
            <AccordionPanel
                className={styles.accordionPanel}
                style={
                    {
                        "--lineage-index": lineageIndex,
                        marginLeft: "calc(var(--lineage-index) * 1rem)",
                    } as CSSProperties
                }
            >
                <div className={styles.accordion}>
                    {category.categories.map((subcategory, index: number) => {
                        const key = rootKey + "/" + subcategory.name + index;
                        const mainAttribute = subcategory.mainAttribute;
                        const mainAttributeValue =
                            mainAttribute && (dataJSON?.[mainAttribute.name] ?? mainAttribute.default);
                        const isExpandable = subcategory.categories.length > 0 || subcategory.description.length > 0;

                        return (
                            <AccordionItem key={key} isExpandable={isExpandable} className={styles.accordionItem}>
                                <AccordionButton isExpandable={isExpandable} className={styles.accordionButton}>
                                    <div className={styles.subCategory}>
                                        <div className={styles.subCategoryHeader}>
                                            <Icon
                                                // as={isExpanded ? FaFolderOpen : FaFolder}
                                                as={FaFolder}
                                                size="xs"
                                                style={{
                                                    color: "var(--3dverse-color-content-tertiary)",
                                                    opacity: mainAttribute && !mainAttributeValue ? 0.25 : 0.5,
                                                    visibility: !isExpandable ? "hidden" : undefined,
                                                }}
                                            />
                                            <p
                                                className={styles.subCategoryName}
                                                style={
                                                    mainAttribute
                                                        ? {
                                                              color: mainAttributeValue
                                                                  ? ""
                                                                  : "var(--3dverse-color-content-quaternary)",
                                                          }
                                                        : {}
                                                }
                                            >
                                                {subcategory.name}
                                            </p>
                                        </div>
                                        {mainAttribute && (
                                            <Checkbox
                                                id={key + "-" + mainAttribute.name}
                                                size="xs"
                                                name={mainAttribute.name}
                                                title={mainAttribute.description}
                                                isChecked={mainAttributeValue}
                                                onChange={event => onChange(mainAttribute.name, event.target.checked)}
                                            />
                                        )}
                                    </div>
                                </AccordionButton>
                                <div style={mainAttribute && !mainAttributeValue ? { opacity: 0.5 } : {}}>
                                    {renderCategory(subcategory, lineageIndex + 1, key)}
                                </div>
                            </AccordionItem>
                        );
                    })}
                </div>

                {category.description.length > 0 && (
                    <>
                        {category.description.map((input, index) => {
                            const value = dataJSON?.[input.name] ?? input.default;
                            const defaultValue = input.default;
                            const isDisabled = value === undefined || value === defaultValue;
                            return (
                                <div key={index} className={styles.formControl}>
                                    <label title={input.description} htmlFor={input.name} className={styles.formLabel}>
                                        {input.name}
                                    </label>
                                    <div className={styles.formControlWrapper}>
                                        <FormControlWidget
                                            type={input.type}
                                            id={input.name}
                                            size="xs"
                                            value={value}
                                            defaultValue={input.default}
                                            onChange={(_, value) =>
                                                onChange(input.name, value as RenderGraphDataObject[string])
                                            }
                                        />
                                        <Tooltip label="Reset" isDisabled={isDisabled}>
                                            <IconButton
                                                aria-label="Reset input"
                                                variant="ghost"
                                                size="xs"
                                                className={styles.resetButton}
                                                icon={<Icon as={FaArrowRotateLeft} size="xs" />}
                                                isDisabled={isDisabled}
                                                onClick={() => onResetInput(input.name, defaultValue)}
                                            />
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </AccordionPanel>
        );
    };

    //--------------------------------------------------------------------------
    return (
        <div className="livelink-react-ui-component">
            {!cameraEntity ? (
                <div className={styles.spinnerContainer}>
                    {/* TODO: Replace spinner by skeletons */}
                    <Spinner />
                </div>
            ) : (
                <div className={styles.innerContainer}>
                    {renderGraphDescription && renderCategory(renderGraphDescription)}
                    <ResetAllButton onClick={onResetAllInputs} />
                </div>
            )}
        </div>
    );
};

//------------------------------------------------------------------------------
const computeCategories = (inputDescriptor: Input[]): Category => {
    //--------------------------------------------------------------------------
    const root = {
        description: [],
        categories: [],
    } as Category;

    //--------------------------------------------------------------------------
    for (const inputDesc of inputDescriptor) {
        const { categories = [] } = inputDesc;

        let currentInputDescriptor = root;
        for (const category of categories) {
            let subCategory = currentInputDescriptor.categories.find(c => c?.name && c.name === category);
            if (!subCategory) {
                subCategory = {
                    name: category,
                    description: [],
                    categories: [],
                };

                currentInputDescriptor.categories.push(subCategory);
            }

            currentInputDescriptor = subCategory as Category;
        }

        if (
            currentInputDescriptor.name &&
            inputDesc.type === "bool" &&
            inputDesc.name.toLowerCase().replaceAll(" ", "") ===
                currentInputDescriptor.name.toLowerCase().replaceAll(" ", "")
        ) {
            currentInputDescriptor.mainAttribute = inputDesc;
        } else {
            currentInputDescriptor.description.push(inputDesc);
        }
    }

    //--------------------------------------------------------------------------
    return root;
};

//--------------------------------------------------------------------------
const ResetAllButton = ({ onClick }: { onClick: () => void }) => {
    return (
        <Button variant="ghost" size="xs" className={styles.resetAllButton} onClick={onClick}>
            Reset all
        </Button>
    );
};
