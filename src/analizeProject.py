import sys
import os
import shutil
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders.generic import GenericLoader
from langchain_community.document_loaders.parsers import LanguageParser

from langchain_cohere import CohereEmbeddings # type: ignore
from langchain_cohere import ChatCohere # type: ignore

from langchain_chroma import Chroma # type: ignore
from langchain.memory import ConversationSummaryBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import DirectoryLoader
from langchain.schema import Document

#project_path = sys.argv[1]
#userTask = sys.argv[2]

project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\Project2\\'
userTask = 'I want to change the delete_snapshots function'

print("Step 2: Load and parse Python files from the specified local directory")
# Load only Python files in the specified directory, not subdirectories
loader = DirectoryLoader(
    project_path,
     glob="**/*.py", # Recursive search for .py files in all subdirectories
)
docs = loader.load()
# Print each document's path and content length to detect duplicates
print("Loaded files with content lengths:")
for idx, doc in enumerate(docs):
    print(f"Document {idx+1}: {doc.metadata.get('source')}, Content length: {len(doc.page_content)}")

# Check for unique documents
unique_docs = {(doc.metadata.get("source"), len(doc.page_content)) for doc in docs}
print(f"Total unique documents by path and content length: {len(unique_docs)}")




# Define function to adapt chunk parameters based on document length
def get_chunk_params(doc_length):
    if doc_length < 500:
        return {"chunk_size": doc_length, "chunk_overlap": 0}  # No splitting needed
    elif doc_length < 2000:
        return {"chunk_size": 300, "chunk_overlap": 50}
    else:
        return {"chunk_size": 500, "chunk_overlap": 100}

print("Step 3: Chunk the code for efficient processing")

adaptive_texts = []
for doc in docs:
    # Get adaptive chunk parameters based on document length
    params = get_chunk_params(len(doc.page_content))
    documents_splitter = RecursiveCharacterTextSplitter.from_language(
        language="python",
        **params
    )
    adaptive_texts.extend(documents_splitter.split_documents([doc]))

print(f"Total number of chunks created: {len(adaptive_texts)}")



print("Step 4: Create embeddings and store them in a vector database")

# Initialize the embeddings model
embeddings_model = CohereEmbeddings(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model='embed-english-v3.0')

# Generate and verify a sample embedding for validation
try:
    sample_embedding = embeddings_model.embed_query(adaptive_texts[0].page_content)
    print("Sample Embedding:", sample_embedding[:10])
except Exception as e:
    print("Error generating embeddings:", e)



# Check if the directory exists and delete it
if os.path.exists('./data'):
    shutil.rmtree('./data')



# Initialize Chroma with embeddings and persist settings
vectordb = Chroma.from_documents(adaptive_texts, embedding=embeddings_model, persist_directory='./data')

print("Embeddings successfully stored in vector database.")


print("Step 5: Initialize the LLM and memory for retrieval chain")
llm = ChatCohere(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model="command-r-plus-08-2024")

qa_chain = RetrievalQA.from_chain_type(
    llm = llm,
    chain_type='stuff',
    retriever=vectordb.as_retriever(search_type="mmr"),
    verbose=True
)

# Execute the query
#response = qa_chain.invoke({"question": userTask, "chat_history": []})

finalPrompt = """Analyze the documents i have provided and based on this specific task: """ + userTask + """, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30% .List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations."""

finalPromptV2 = """
I need you to analyze the files in the vector database, which contains embeddings for each file's contents segmented into separate chunks. 
Also, a user task has its own embedding vector, representing the task to be performed. Use this user task embedding to calculate similarity against each file’s embedding. 
Based on this similarity, provide a list of the files along with a probability score reflecting the likelihood that each file will need modification to fulfill the task. 
Format your response as follows:
Path1 - 85%
Path2 - 70%
Path3 - 0%
...
List the files by probability in descending order, include only the file path and probability, and avoid any additional text or explanations.
"""

finalPromptV3 = """
Alongside this prompt, i have provided some documents which are a vector database, which have the ids, vector embeddings, documents, and metadata, for each chunk of code of multiple files in a python project, 
as well as a userTask. I want you to determine the likelihood that each file will need to be modified in order to complete said user task. For this i want you to make use of the embedding vectors. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30% .List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations.
"""

finalPromptV4 = """
Based on the documents that i have provided, which files would i need to change in order to """ + userTask +"""?
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability.
The response should look like this: Path1 - 85% Path2 - 70%... Include only the file path and probability, and avoid any additional text or explanations.
"""


finalPromptV5 = """
The documents that i am providing you, how do you access them? Are they just the chunks of the code or is there also metadata?
"""

response = qa_chain.invoke({"query": finalPromptV5, "chat_history": []})

print(response['result'])









