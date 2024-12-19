//------------------------------------------------------------------------------
import React, { CSSProperties, useEffect, useState } from "react";
import {
    Accordion,
    AccordionButton,
    AccordionItem,
    AccordionPanel,
    Box,
    Button,
    Checkbox,
    Flex,
    FormControl,
    FormLabel,
    Icon,
    IconButton,
    Spinner,
    Text,
    Tooltip,
} from "@chakra-ui/react";
import { Entity } from "@3dverse/livelink";
import { getAssetDescription, setUserToken } from "@3dverse/api";
import { FaArrowRotateLeft, FaFolder, FaFolderOpen } from "react-icons/fa6";

//------------------------------------------------------------------------------
import { Provider } from "../../chakra/Provider";
import { FormControlWidget } from "../FormControlWidget";

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
    defaultCameraSettings,
}: {
    userToken: string;
    cameraEntity: Entity | null;
    defaultCameraSettings?: Record<string, unknown>;
}) => {
    //------------------------------------------------------------------------------
    const [originalDataJSON, setOriginalDataJSON] = useState(cameraEntity?.camera?.dataJSON);
    const [dataJSON, setDataJSON] = useState(cameraEntity?.camera?.dataJSON);
    const [renderGraphDescription, setRenderGraphDescription] = useState<Category | null>(null);

    //------------------------------------------------------------------------------
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

    //------------------------------------------------------------------------------
    const onChange = (attributeName: string, attributeValue: boolean | number | number[]) => {
        if (!cameraEntity?.camera?.dataJSON) {
            return null;
        }

        cameraEntity.camera.dataJSON[attributeName] = attributeValue;
        setDataJSON({ ...cameraEntity.camera.dataJSON });
    };

    //------------------------------------------------------------------------------
    const onResetInput = (attributeName: string, defaultValue: boolean | number | number[]) => {
        onChange(attributeName, defaultValue);
    };

    //------------------------------------------------------------------------------
    const onResetAllInputs = () => {
        if (!cameraEntity?.camera?.dataJSON) {
            return null;
        }

        cameraEntity.camera.dataJSON = originalDataJSON;
        setDataJSON(originalDataJSON);
    };

    //--------------------------------------------------------------------------
    const renderCategory = (category: Category, lineageIndex = 0, rootKey = "") => {
        return (
            <Box
                marginLeft="calc(var(--lineage-index) * 0.5rem)"
                style={{ "--lineage-index": lineageIndex } as CSSProperties}
            >
                <Accordion allowMultiple size="sm">
                    {category.categories.map((subcategory, index: number) => {
                        const key = rootKey + "/" + subcategory.name + index;
                        const mainAttribute = subcategory.mainAttribute;
                        const mainAttributeValue =
                            mainAttribute && (dataJSON?.[mainAttribute.name] ?? mainAttribute.default);
                        const isExpandable = subcategory.categories.length > 0 || subcategory.description.length > 0;

                        return (
                            <AccordionItem key={key}>
                                {({ isExpanded }) => (
                                    <>
                                        <AccordionButton as={!isExpandable ? Box : undefined} pl={0} pr={2} py={1}>
                                            <Flex flexGrow={1}>
                                                <Flex alignItems="center" flexGrow={1} gap={3}>
                                                    <Icon
                                                        as={isExpanded ? FaFolderOpen : FaFolder}
                                                        boxSize=".65rem"
                                                        color="content.tertiary"
                                                        opacity={0.75}
                                                        visibility={!isExpandable ? "hidden" : undefined}
                                                    />
                                                    <Text
                                                        size="xs"
                                                        fontWeight={500}
                                                        userSelect="none"
                                                        color={
                                                            mainAttributeValue
                                                                ? "content.secondary"
                                                                : "content.tertiary"
                                                        }
                                                    >
                                                        {subcategory.name}
                                                    </Text>
                                                </Flex>
                                                {mainAttribute && (
                                                    <Checkbox
                                                        id={key + "-" + mainAttribute.name}
                                                        name={mainAttribute.name}
                                                        title={mainAttribute.description}
                                                        size="sm"
                                                        isChecked={mainAttributeValue}
                                                        onChange={event =>
                                                            onChange(mainAttribute.name, event.target.checked)
                                                        }
                                                    />
                                                )}
                                            </Flex>
                                        </AccordionButton>
                                        <AccordionPanel p={0}>
                                            {renderCategory(subcategory, lineageIndex + 1, key)}
                                        </AccordionPanel>
                                    </>
                                )}
                            </AccordionItem>
                        );
                    })}
                </Accordion>

                {category.description.length > 0 && (
                    <>
                        {category.description.map((input, index) => {
                            const value = dataJSON?.[input.name] ?? input.default;
                            const defaultValue = defaultCameraSettings?.[input.name] || input.default;
                            const isDisabled = value === undefined || value === defaultValue;
                            return (
                                <FormControl
                                    key={index}
                                    as={Flex}
                                    flexDir="row"
                                    alignItems="center"
                                    gap={3}
                                    pr="3px"
                                    size="sm"
                                    cursor="pointer"
                                    transition="background-color"
                                    transitionDuration=".22s"
                                    _hover={{
                                        bgColor: "bg.foreground",
                                    }}
                                    _focus={{
                                        bgColor: "bg.foreground",
                                    }}
                                >
                                    <FormLabel
                                        title={input.description}
                                        flexGrow={1}
                                        m={0}
                                        px={3}
                                        py={1}
                                        fontSize="xs"
                                        textTransform="capitalize"
                                        noOfLines={1}
                                        cursor="pointer"
                                        userSelect="none"
                                    >
                                        {input.name}
                                    </FormLabel>
                                    <Flex alignItems="center" gap={2} flexShrink={0}>
                                        <FormControlWidget
                                            type={input.type}
                                            value={value}
                                            defaultValue={input.default}
                                            onChange={(_, value) => onChange(input.name, value)}
                                        />
                                        <Tooltip
                                            label="Reset"
                                            size="xs"
                                            placement="top"
                                            gutter={2}
                                            isDisabled={isDisabled}
                                        >
                                            <IconButton
                                                variant="ghost"
                                                aria-label="Reset input"
                                                size="xs"
                                                boxSize={5}
                                                minW="auto"
                                                flexShrink={0}
                                                color="content.tertiary"
                                                icon={<Icon as={FaArrowRotateLeft} size="xs" />}
                                                isDisabled={isDisabled}
                                                onClick={() => onResetInput(input.name, defaultValue)}
                                            />
                                        </Tooltip>
                                    </Flex>
                                </FormControl>
                            );
                        })}
                    </>
                )}
            </Box>
        );
    };

    //--------------------------------------------------------------------------

    return (
        <Provider>
            {!cameraEntity ? (
                <Flex alignItems="center" justifyContent="center" py={8}>
                    {/* TODO: Replace spinner by skeletons */}
                    <Spinner size="sm" />
                </Flex>
            ) : (
                <Flex flexDir="column" pl={3}>
                    {renderGraphDescription && renderCategory(renderGraphDescription)}
                    <ResetAllButton onClick={onResetAllInputs} />
                </Flex>
            )}
        </Provider>
    );
};

//--------------------------------------------------------------------------
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
        <Button
            variant="ghost"
            size="xs"
            mt={2}
            mr={2}
            color="content.tertiary"
            w="max-content"
            alignSelf="end"
            onClick={onClick}
        >
            Reset all
        </Button>
    );
};
