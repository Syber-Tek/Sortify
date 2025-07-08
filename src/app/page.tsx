"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  FileUp,
  Download,
  Users,
  Wand2,
  Loader2,
  TableIcon,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateGroupNamesAction } from "./actions";

type RowData = Record<string, any>;

interface Group {
  name: string;
  members: RowData[];
}

const formSchema = z
  .object({
    numGroups: z.coerce.number().int().min(1, "At least one group is required."),
    membersPerGroup: z.coerce
      .number()
      .int()
      .min(1, "Each group needs at least one member."),
    autoNameGroups: z.boolean().default(true),
    customGroupNames: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.autoNameGroups) {
      if (
        !data.customGroupNames ||
        data.customGroupNames.length !== data.numGroups
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a name for each group.",
          path: ["customGroupNames"],
        });
        return;
      }
      data.customGroupNames.forEach((name, index) => {
        if (!name || name.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Group name cannot be empty.",
            path: [`customGroupNames.${index}`],
          });
        }
      });
    }
  });

export default function XLSXGrouperPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<RowData[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [groupedData, setGroupedData] = React.useState<Group[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [fileName, setFileName] = React.useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numGroups: 2,
      membersPerGroup: 5,
      autoNameGroups: true,
      customGroupNames: [],
    },
  });

  const numGroups = form.watch("numGroups");
  const autoNameGroups = form.watch("autoNameGroups");

  React.useEffect(() => {
    const names = Array.from({ length: numGroups }, () => "");
    form.setValue("customGroupNames", names);
  }, [numGroups, form]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setGroupedData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        if (!fileData) throw new Error("Could not read file data.");
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
            throw new Error("The uploaded file is empty or in an invalid format.");
        }
        
        setData(jsonData as RowData[]);
        setHeaders(Object.keys(jsonData[0] as object));
        toast({
          title: "File uploaded successfully!",
          description: `${jsonData.length} rows loaded from ${file.name}.`,
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Error processing file",
          description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
        setFileName("");
        setData([]);
      }
    };
    reader.onerror = () => {
        toast({
            variant: "destructive",
            title: "Error reading file",
            description: "There was an issue reading the selected file.",
        });
    };
    reader.readAsArrayBuffer(file);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to group",
        description: "Please upload an XLSX file first.",
      });
      return;
    }
    
    if (values.numGroups * values.membersPerGroup > data.length) {
      toast({
        variant: "destructive",
        title: "Not enough data",
        description: `You requested ${values.numGroups} groups of ${values.membersPerGroup}, but only ${data.length} data rows are available.`,
      });
      return;
    }

    setIsLoading(true);
    setGroupedData([]);

    let groupNames: string[] = [];

    try {
      if (values.autoNameGroups) {
        const dataSummary = `The data contains columns: ${headers.join(
          ", "
        )}. Here are the first 3 rows: ${JSON.stringify(data.slice(0, 3))}`;
        groupNames = await generateGroupNamesAction(
          dataSummary,
          values.numGroups
        );
      } else {
        groupNames = values.customGroupNames!;
      }

      const shuffledData = [...data].sort(() => Math.random() - 0.5);
      const newGroups: Group[] = [];

      for (let i = 0; i < values.numGroups; i++) {
        const members = shuffledData.splice(0, values.membersPerGroup);
        newGroups.push({
          name: groupNames[i] || `Group ${i + 1}`,
          members: members,
        });
      }

      setGroupedData(newGroups);
      toast({
        title: "Grouping complete!",
        description: `${data.length} items have been split into ${values.numGroups} groups.`,
      });
    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "An error occurred",
            description: "Failed to generate group names or create groups. Please try again.",
        })
    } finally {
        setIsLoading(false);
    }
  };

  const handleDownload = () => {
    try {
        const workbook = XLSX.utils.book_new();
        groupedData.forEach((group) => {
          const worksheet = XLSX.utils.json_to_sheet(group.members);
          const safeSheetName = group.name.replace(/[*?:\\/\[\]]/g, "").substring(0, 31);
          XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
        });
        XLSX.writeFile(workbook, "grouped_data.xlsx");
    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: "Could not generate the XLSX file for download.",
        })
    }
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4 flex items-center gap-3 text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-600">
           <Users className="h-10 w-10 text-purple-500"/> XLSX Grouper
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Upload your .xlsx file, define your grouping parameters, and let our
          tool (with a little help from AI) organize your data.
        </p>
      </div>

      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">1. Setup Your Groups</CardTitle>
          <CardDescription>
            Start by uploading a file and defining how you want to group your data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center hover:border-accent transition-colors duration-300">
                <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <Label htmlFor="file-upload" className="mt-4 block font-semibold text-accent cursor-pointer">
                  Click to upload a file or drag and drop
                </Label>
                <p className="text-xs text-muted-foreground mt-1">.xlsx files only</p>
                <Input
                  id="file-upload"
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  required
                />
              </div>
              {fileName && (
                <div className="flex items-center justify-center text-sm text-muted-foreground p-2 bg-muted rounded-md">
                  <FileText className="h-4 w-4 mr-2" />
                  <span>{fileName} ({data.length} rows)</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="numGroups"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Groups</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 4" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="membersPerGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Members per Group</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="autoNameGroups"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Auto-generate Group Names
                      </FormLabel>
                      <FormDescription>
                        Use AI to create meaningful names for your groups.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!autoNameGroups && (
                <div className="space-y-4">
                  <Label>Custom Group Names</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: numGroups > 0 ? numGroups : 0 }).map((_, index) => (
                      <FormField
                        key={index}
                        control={form.control}
                        name={`customGroupNames.${index}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder={`Group ${index + 1} Name`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            <CardFooter className="p-0 pt-6">
                <Button type="submit" className="w-full" disabled={isLoading || data.length === 0}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : autoNameGroups ? (
                    <Wand2 className="mr-2 h-4 w-4" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? "Grouping..." : "Generate Groups"}
                </Button>
            </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>

      {groupedData.length > 0 && (
        <Card className="max-w-7xl mx-auto mt-8 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl">2. Your Groups</CardTitle>
                <CardDescription>
                    Here is your data, organized into new groups. You can now download it.
                </CardDescription>
            </div>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download XLSX
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {groupedData.map((group, index) => (
                <Card key={index} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-accent">
                        <TableIcon className="h-5 w-5" />
                        {group.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ScrollArea className="h-72 w-full rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {headers.map((header) => (
                              <TableHead key={header}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.members.map((member, memberIndex) => (
                            <TableRow key={memberIndex}>
                              {headers.map((header) => (
                                <TableCell key={header}>
                                  {member[header]}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
