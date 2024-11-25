import json
import subprocess
import pytrec_eval # type: ignore
from typing import Dict, List

def parse_output(output: str) -> Dict[str, List]:
    results = {}
    lines = output.splitlines()
    #print(lines)
    capture = False
    for line in lines:
        if "> Finished chain." in line:
            capture = True
            continue
        if not capture:
            continue

        # Parse file match or suggested task
        if " - " in line:
            parts = line.split(" - ")
            if len(parts) == 2:
                file_path = parts[0].strip()
                percentage = int(parts[1].strip('%'))
                results[file_path] = percentage
        elif "Suggested task:" in line:
            suggested_task = line.split("Suggested task:")[1].strip()
            results["suggested_task"] = suggested_task

    return results

def evaluate_with_beir(model_results, correct_answers, k_values=[1, 3, 5]):
    # Prepare the data in the expected format for BEIR evaluation
    queries = {}
    qrels = {}
    results = {}

    # Construct BEIR compatible data
    for task_id, data in correct_answers.items():
        correct_files = data.get("files_to_modify", [])
        correct_percentages = data.get("percentages", [])

        # Extract file paths and percentages from correct_files
        file_paths_and_percentages = [(file_info["file_path"], file_info["percentage"]) for file_info in correct_files]

        print(f"Task {task_id}\n CORRECT ANSWER : {file_paths_and_percentages}")  # Debugging line
        print(f"Task {task_id}\n MODEL ANSWER : {model_results}")  # Debugging line

        query = f"Task {task_id}: {data['task_description']}"
        queries[str(task_id)] = query  # Convert task_id to string
        qrels[str(task_id)] = {file: 1 for file, percentage in file_paths_and_percentages}  # Relevance score 1 for correct files
        results[str(task_id)] = {}  # Initialize results for this task

        # Populate results with scores for each file
        for file, percentage in file_paths_and_percentages:
            score = model_results.get(file, 0) / 100
            results[str(task_id)][file] = score

    # Prepare metric strings for BEIR
    map_string = "map_cut." + ",".join([str(k) for k in k_values])
    ndcg_string = "ndcg_cut." + ",".join([str(k) for k in k_values])
    recall_string = "recall." + ",".join([str(k) for k in k_values])
    precision_string = "P." + ",".join([str(k) for k in k_values])

    # Define the evaluation measures as a dictionary
    measures = {
        map_string: None,
        ndcg_string: None,
        recall_string: None,
        precision_string: None
    }

    # Initialize the evaluator
    evaluator = pytrec_eval.RelevanceEvaluator(qrels, measures)

    # Call the evaluator.evaluate() method with the correct arguments
    scores = evaluator.evaluate(results)

    # Initialize dictionaries for storing final metrics
    ndcg = {}
    _map = {}
    recall = {}
    precision = {}

    # Initialize metrics for each k value
    for k in k_values:
        ndcg[f"NDCG@{k}"] = 0.0
        _map[f"MAP@{k}"] = 0.0
        recall[f"Recall@{k}"] = 0.0
        precision[f"P@{k}"] = 0.0

    # Process the results to calculate average metrics
    for query_id in scores.keys():
        for k in k_values:
            ndcg[f"NDCG@{k}"] += scores[query_id]["ndcg_cut_" + str(k)]
            _map[f"MAP@{k}"] += scores[query_id]["map_cut_" + str(k)]
            recall[f"Recall@{k}"] += scores[query_id]["recall_" + str(k)]
            precision[f"P@{k}"] += scores[query_id]["P_" + str(k)]

    # Calculate the average for each metric and k value
    for k in k_values:
        ndcg[f"NDCG@{k}"] = round(ndcg[f"NDCG@{k}"] / len(scores), 5)
        _map[f"MAP@{k}"] = round(_map[f"MAP@{k}"] / len(scores), 5)
        recall[f"Recall@{k}"] = round(recall[f"Recall@{k}"] / len(scores), 5)
        precision[f"P@{k}"] = round(precision[f"P@{k}"] / len(scores), 5)

    # Return the final metrics
    return ndcg, _map, recall, precision

def average_metrics(metrics_list):
    # Initialize accumulators for each metric
    total_ndcg = {}
    total_map = {}
    total_recall = {}
    total_precision = {}
    num_runs = len(metrics_list)
    num_tasks = 0  # Total number of tasks across all runs

    # Iterate over all runs
    for run_metrics in metrics_list:
        for ndcg, _map, recall, precision in run_metrics:
            num_tasks += 1
            for k, value in ndcg.items():
                total_ndcg[k] = total_ndcg.get(k, 0) + value
            for k, value in _map.items():
                total_map[k] = total_map.get(k, 0) + value
            for k, value in recall.items():
                total_recall[k] = total_recall.get(k, 0) + value
            for k, value in precision.items():
                total_precision[k] = total_precision.get(k, 0) + value

    # Average the metrics
    averaged_ndcg = {k: round(v / num_tasks, 5) for k, v in total_ndcg.items()}
    averaged_map = {k: round(v / num_tasks, 5) for k, v in total_map.items()}
    averaged_recall = {k: round(v / num_tasks, 5) for k, v in total_recall.items()}
    averaged_precision = {k: round(v / num_tasks, 5) for k, v in total_precision.items()}

    return {
        "NDCG": averaged_ndcg,
        "MAP": averaged_map,
        "Recall": averaged_recall,
        "Precision": averaged_precision,
    }




def main(json_file_path, analyze_script_path, runs=5):
    with open(json_file_path, "r") as f:
        test_data = json.load(f)

    all_metrics = []

    for _ in range(runs):
        run_metrics = []
        for task in test_data["tasks"]:
            task_id = task["task_id"]
            task_description = task["task_description"]
            correct_files = task.get("files_to_modify", [])
            correct_percentages = task.get("percentages", [])

            # Run the analysis script
            command = [
                "python", analyze_script_path,
                test_data["path"],
                task_description
            ]
            result = subprocess.run(command, capture_output=True, text=True)
            model_output = result.stdout
            parsed_results = parse_output(model_output)

            # Check if we have a suggested task
            suggested_task = parsed_results.get("suggested_task", None)
            if not correct_files and suggested_task:
                print(f"Task {task_id}: Suggested task validation successful.")
            elif not correct_files:
                print(f"Task {task_id}: Failed to suggest a new task.")
            else:
                # BEIR evaluation
                metrics = evaluate_with_beir(parsed_results, {task_id: task})
                run_metrics.append(metrics)

        all_metrics.append(run_metrics)

    # Compute overall statistics
    print("Overall Metrics:")
    print(all_metrics)

    averaged_metrics = average_metrics(all_metrics)

    print("Averaged Metrics:")
    for metric_type, values in averaged_metrics.items():
        print(f"{metric_type}:")
        for cutoff, value in values.items():
            print(f"  {cutoff}: {value}")

if __name__ == "__main__":
    json_file_path = "C:\\Users\\uc201\\FileGuide\\fileguide\\src\\ProjectTasks\\2048.json"
    analyze_script_path = "C:\\Users\\uc201\\FileGuide\\fileguide\\src\\analizeProjectV3.py"
    main(json_file_path, analyze_script_path)