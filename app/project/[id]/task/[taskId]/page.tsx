"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { CommentSection } from "@/components/shared/CommentSection"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface Task {
    id: string
    title: string
    description: string
    status: string
}

export default function TaskView({ params }: { params: { id: string, taskId: string } }) {
    const [task, setTask] = useState<Task | null>(null)

    useEffect(() => {
        const fetchTask = async () => {
            const { data } = await supabase
                .from("tasks")
                .select("*")
                .eq("id", params.taskId)
                .single()
            setTask(data)
        }
        fetchTask()
    }, [params.taskId])

    if (!task) return <div className="p-8">Loading task...</div>

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>{task.title}</CardTitle>
                    <span className="text-sm text-gray-500 uppercase">{task.status}</span>
                </CardHeader>
                <CardContent>
                    <p>{task.description || "No description provided."}</p>
                </CardContent>
            </Card>

            <div>
                <h3 className="text-lg font-bold mb-4">Comments</h3>
                <CommentSection taskId={task.id} />
            </div>
        </div>
    )
}
